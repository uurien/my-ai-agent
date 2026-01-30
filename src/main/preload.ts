import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke('save-api-key', apiKey),
  sendMessage: (message: string) => ipcRenderer.invoke('send-message', message),
  onMessageChunk: (callback: (chunk: string) => void) => {
    ipcRenderer.on('message-chunk', (_, chunk) => callback(chunk));
  },
  onMessageComplete: (callback: (data: { reply: string; actions: unknown[] }) => void) => {
    ipcRenderer.on('message-complete', (_, data) => callback(data));
  },
  onMessageError: (callback: (error: string) => void) => {
    ipcRenderer.on('message-error', (_, error) => callback(error));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  executeCommand: (command: string) => ipcRenderer.invoke('execute-command', command),
  onCommandResult: (callback: (result: string) => void) => {
    ipcRenderer.on('command-result', (_, result) => callback(result));
  },
  removeAllCommandListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  getHistory: () => ipcRenderer.invoke('get-history'),
  onCommandExecuted: (callback: (data: { command: string; explanation: string; result: string }) => void) => {
    ipcRenderer.on('command-executed', (_, data) => callback(data));
  },
  onAskConfirmation: (callback: (data: { command: string; explanation: string; severity: number }) => void) => {
    ipcRenderer.on('ask-confirmation', (_, data) => callback(data));
  },
  askConfirmationReturn: (data: boolean) => {
    ipcRenderer.send('ask-confirmation-return', data);
  },
  updateMessagesInUI: (messages: any[]) => ipcRenderer.invoke('update-messages-in-ui', messages),
  terminalInitialize: () => ipcRenderer.invoke('terminal-initialize'),
  writeTerminalData: (data: string) => ipcRenderer.invoke('write-terminal-data', data),
  resizeTerminal: (cols: number, rows: number) => ipcRenderer.invoke('resize-terminal', cols, rows),
  onDataOnTerminal: (callback: (data: string) => void) => {
    console.log('onDataOnTerminal');
    ipcRenderer.on('data-on-terminal', (_, data) => callback(data));
  }
});

