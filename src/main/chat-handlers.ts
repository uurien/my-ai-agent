import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { ipcMain, BrowserWindow } from 'electron';
import OpenAI from 'openai';
import { store } from './settings-handlers';

const tools = [{
  type: 'function' as const,
  function: {
    name: 'execute_command',
    description: 'Execute a shell command on the macOS system. Use this when you need to run commands to get information or perform actions.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute (e.g., "ls -la", "ps aux", "kubectl get pods")'
        },
        explanation: {
          type: 'string',
          description: 'Brief explanation of what this command does and why it\'s being executed'
        },
        severity: {
          type: 'number',
          description: `The severity of the command (0 = low, 1 = medium, 2 = high). This is used to determine the risk of the command.
- Severity 0 (Low): Only for completely innocuous commands that don't access sensitive information, don't modify the system, and don't delete files. Examples: "ls -la", "ps aux", "kubectl get pods", "date", "whoami".
- Severity 1 (Medium): Commands that access sensitive information, delete files, or modify system configuration. Examples: "cat /etc/passwd", "rm file.txt", "kubectl delete pod <name>", accessing logs with sensitive data.
- Severity 2 (High): Commands that can cause data loss, system instability, or significant impact. Examples: "rm -rf /", "reboot", "shutdown", "kubectl delete namespace", destructive operations.
Rule of thumb: If a command accesses sensitive information (passwords, keys, personal data, system configs) or modifies/deletes anything, it should be at least severity 1. Only truly read-only, non-sensitive commands should be severity 0.
          `,
        }
      },
      required: ['command', 'explanation', 'severity']
    }
  }
}];

let messageHistory: any[] = [];
let messagesInUI: any[] = [];

let systemDescription = 'You are AI Agent, a helpful assistant specialized in system administration.';

async function executeCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}


// TODO make this method recursive to handle follow up messages properly
async function sendMessageToLLMRecursive(
  messages: { role: string, content: string }[],
  mainWindow: BrowserWindow,
  client: OpenAI
) {
  messageHistory.push(...messages);

  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    stream: true,
    messages: messageHistory,
    tools: tools,
    tool_choice: 'auto'
  });

  let fullReply = '';
  let toolCalls: any[] = [];
  
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    // Handle content chunks
    const content = delta?.content || '';
    if (content) {
      fullReply += content;
      if (mainWindow) {
        mainWindow.webContents.send('message-chunk', content);
      }
    }
    
    // Handle tool calls
    if (delta?.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        if (toolCall.index !== undefined) {
          // Initialize tool call if new
          if (!toolCalls[toolCall.index]) {
            toolCalls[toolCall.index] = {
              id: toolCall.id,
              type: toolCall.type,
              function: {
                name: '',
                arguments: ''
              }
            };
          }
          
          // Accumulate function name and arguments
          if (toolCall.function?.name) {
            toolCalls[toolCall.index].function.name += toolCall.function.name;
          }
          if (toolCall.function?.arguments) {
            toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
          }
        }
      }
    }
  }

  // Add assistant message with tool calls if any
  const assistantMessage: any = {
    role: 'assistant',
    content: fullReply.trim()
  };
  
  if (toolCalls.length > 0) {
    assistantMessage.tool_calls = toolCalls;
  }
  
  messageHistory.push(assistantMessage);

  const actions: unknown[] = [];
  if (toolCalls.length > 0) {
    const followUpMessages: any[] = []
    for (const toolCall of toolCalls) {
      if (toolCall.function?.name === 'execute_command') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const command = args.command;
          const explanation = args.explanation;
          const severity = args.severity;
          let executeAction: boolean = true
          const cancelledMessage = 'User cancelled the command'
          if (severity >= 1) {
            executeAction = false;
            // TODO ask confirmation to the user before executing the command
            mainWindow?.webContents.send('ask-confirmation', { command, explanation, severity })

            executeAction = await new Promise(resolve => {
              ipcMain.once('ask-confirmation-return', (event, data) => {
                resolve(data);
              });
            });

            if (executeAction) {
              actions.push({ command, explanation, severity });
            }
          } else {
            actions.push({ command, explanation, severity });
          }
          
          // Execute the command
          try {
            let result = ''
            if (executeAction) {
              result = await executeCommand(command);
            } else {
              result = cancelledMessage;
            }

            // Add tool result to history
            followUpMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result.trim()
            });
          } catch (error: any) {
            // Add error to history
            followUpMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Error: ${error.message || error}: ${error.stderr}`
            });
          }
        } catch (error) {
          console.error('Error parsing tool call arguments:', error);
        }
      }
    }

    if (followUpMessages.length > 0) {
      fullReply += '\n\n' + await sendMessageToLLMRecursive(followUpMessages, mainWindow, client);
    }
  }

  return fullReply;
}

async function sendMessageToLLM(
  message: { role: string, content: string },
  mainWindow: BrowserWindow | null
) {
  if (!mainWindow) {
    throw new Error('MainWindow is not available');
  }

  const apiKey = (store as any).get('apiKey', '') as string;

  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Please set it in Settings.');
  }

  const client = new OpenAI({ apiKey });

  if (messageHistory.length === 0) {
    messageHistory.push({
      role: 'system',
      content: systemDescription
    });
  }

  // Define the execute_command tool
  try {
    const fullReply = await sendMessageToLLMRecursive([message], mainWindow, client);
    
    // Send completion signal
    if (mainWindow) {
      mainWindow.webContents.send('message-complete', { reply: fullReply.trim() });
    }
    
    return {
      success: true,
      reply: fullReply.trim()
    };
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    if (mainWindow) {
      mainWindow.webContents.send('message-error', error instanceof Error ? error.message : 'Failed to get response from OpenAI API.');
    }
    throw new Error('Failed to get response from OpenAI API.');
  }
}

// Register chat IPC handlers
export function registerChatHandlers(getMainWindow: () => BrowserWindow | null): void {
  try {
    const systemDescriptionPath = path.join(__dirname, '..', 'resources', 'completions_system_description.md');

    if (fs.existsSync(systemDescriptionPath)) {
      const contents = fs.readFileSync(systemDescriptionPath, 'utf-8').trim();
      if (contents.length > 0) {
        systemDescription = contents;
      }
    }
  } catch (error) {
    console.error('Unable to load completions system description:', error);
  }

  const history = (store as any).get('history', { messagesInUI: [], messageHistory: [] });
  
  messagesInUI = history.messagesInUI;
  messageHistory = history.messageHistory;

  ipcMain.handle('get-history', () => {
    return messagesInUI;
  });

  ipcMain.handle('update-messages-in-ui', (event, messages: any[]) => {
    messagesInUI = messages;
    (store as any).set('history', { messagesInUI, messageHistory });
  });

  // IPC handler to send message with streaming
  ipcMain.handle('send-message', async (event, message: string) => {
    return await sendMessageToLLM({
      role: 'user',
      content: message
    }, getMainWindow());
  });

  ipcMain.handle('execute-command', async (event, command: string) => {
    const mainWindow = getMainWindow();
    const result = await executeCommand(command);
    
    // Send command result to LLM
    const commandOutput = result.trim();
    const resultMessage = `Command executed: ${command}\n\nOutput:\n${commandOutput}`;
    
    return await sendMessageToLLM({
      role: 'user',
      content: resultMessage
    }, mainWindow);
  });
}

