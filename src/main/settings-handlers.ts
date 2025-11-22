import { ipcMain } from 'electron';
import Store from 'electron-store';

// Define store schema
interface StoreSchema {
  apiKey: string;
}

// Configure electron-store
export const store = new Store<StoreSchema>({
  defaults: {
    apiKey: ''
  }
});

// IPC handlers to save and load api-key
export function registerSettingsHandlers(): void {
  ipcMain.handle('get-api-key', () => {
    return (store as any).get('apiKey', '') as string;
  });

  ipcMain.handle('save-api-key', (event, apiKey: string) => {
    (store as any).set('apiKey', apiKey);
    return true;
  });
}

