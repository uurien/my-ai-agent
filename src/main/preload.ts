import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke('save-api-key', apiKey),

  // Tab management
  getTabs: () => ipcRenderer.invoke('get-tabs'),
  saveTabs: (tabsData: any) => ipcRenderer.invoke('save-tabs', tabsData),

  // Chat — all with tabId
  sendMessage: (tabId: string, message: string) => ipcRenderer.invoke('send-message', tabId, message),
  onMessageChunk: (callback: (data: { tabId: string; chunk: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('message-chunk', handler);
    return () => ipcRenderer.removeListener('message-chunk', handler);
  },
  onMessageComplete: (callback: (data: { tabId: string; reply: string; actions: unknown[] }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('message-complete', handler);
    return () => ipcRenderer.removeListener('message-complete', handler);
  },
  onMessageError: (callback: (data: { tabId: string; error: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('message-error', handler);
    return () => ipcRenderer.removeListener('message-error', handler);
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  executeCommand: (tabId: string, command: string) => ipcRenderer.invoke('execute-command', tabId, command),
  onCommandResult: (callback: (result: string) => void) => {
    ipcRenderer.on('command-result', (_, result) => callback(result));
  },
  removeAllCommandListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  getHistory: (tabId: string) => ipcRenderer.invoke('get-history', tabId),
  onCommandExecuted: (callback: (data: { command: string; explanation: string; result: string }) => void) => {
    ipcRenderer.on('command-executed', (_, data) => callback(data));
  },
  onAskConfirmation: (callback: (data: { tabId: string; command: string; explanation: string; severity: number }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('ask-confirmation', handler);
    return () => ipcRenderer.removeListener('ask-confirmation', handler);
  },
  askConfirmationReturn: (tabId: string, confirmed: boolean) => {
    ipcRenderer.send('ask-confirmation-return', { tabId, confirmed });
  },
  updateMessagesInUI: (tabId: string, messages: any[]) => ipcRenderer.invoke('update-messages-in-ui', tabId, messages),
  deleteTabHistory: (tabId: string) => ipcRenderer.invoke('delete-tab-history', tabId),

  // Terminal — all with tabId
  terminalInitialize: (tabId: string) => ipcRenderer.invoke('terminal-initialize', tabId),
  writeTerminalData: (tabId: string, data: string) => ipcRenderer.invoke('write-terminal-data', tabId, data),
  resizeTerminal: (tabId: string, cols: number, rows: number) => ipcRenderer.invoke('resize-terminal', tabId, cols, rows),
  destroyTerminal: (tabId: string) => ipcRenderer.invoke('terminal-destroy', tabId),
  onDataOnTerminal: (callback: (tabId: string, data: string) => void) => {
    const handler = (_: any, tabId: string, data: string) => callback(tabId, data);
    ipcRenderer.on('data-on-terminal', handler);
    return () => ipcRenderer.removeListener('data-on-terminal', handler);
  }
});
