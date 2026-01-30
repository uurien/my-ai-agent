import * as path from 'path';
import { app, BrowserWindow } from 'electron';
import { registerSettingsHandlers } from './settings-handlers';
import { registerChatHandlers } from './chat-handlers';
import { registerTerminalHandlers } from './terminal-handlers';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Forward console messages from renderer to main process stdout
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelMap: { [key: number]: string } = {
      0: 'log',
      1: 'info',
      2: 'warn',
      3: 'error'
    };
    const levelName = levelMap[level] || 'log';
    (console as any)[levelName](`[Renderer] ${message}`);
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function initializeApp(): void {
  // Register IPC handlers
  registerSettingsHandlers();
  registerChatHandlers(() => mainWindow);
  registerTerminalHandlers(() => mainWindow);
}

app.whenReady().then(() => {
  initializeApp();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


