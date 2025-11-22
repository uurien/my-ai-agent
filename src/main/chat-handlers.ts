import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { ipcMain, BrowserWindow } from 'electron';
import OpenAI from 'openai';
import { store } from './settings-handlers';

const messageHistory: any[] = [];

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

async function sendMessageToLLM(
  message: { role: string, content: string },
  mainWindow: BrowserWindow | null
) {
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

  messageHistory.push(message);

  // Define the execute_command tool
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
          }
        },
        required: ['command', 'explanation']
      }
    }
  }];

  try {
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
    
    // Execute tool calls
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        if (toolCall.function?.name === 'execute_command') {
          // TODO ask confirmation to the user before executing the command
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const command = args.command;
            const explanation = args.explanation;
            
            actions.push({ command, explanation });
            
            // Execute the command
            try {
              const result = await executeCommand(command);
              
              // Add tool result to history
              messageHistory.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result.trim()
              });
              
              // Send command execution info to renderer
              if (mainWindow) {
                mainWindow.webContents.send('command-executed', { command, explanation, result: result.trim() });
              }
            } catch (error: any) {
              // Add error to history
              messageHistory.push({
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
      
      // If there were tool calls, get a follow-up response
      // TODO this should be recursive, the actions in the follow up response are totally ignored
      const followUpStream = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        stream: true,
        messages: messageHistory
      });
      
      let followUpReply = '';
      for await (const chunk of followUpStream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          followUpReply += content;
          if (mainWindow) {
            mainWindow.webContents.send('message-chunk', content);
          }
        }
      }
      
      messageHistory.push({
        role: 'assistant',
        content: followUpReply.trim()
      });
      
      fullReply += '\n\n' + followUpReply.trim();
    }
    
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

  ipcMain.handle('get-history', () => {
    return messageHistory;
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

