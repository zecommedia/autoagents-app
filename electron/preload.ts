import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  
  // System info
  getMachineId: () => ipcRenderer.invoke('system:getMachineId'),
  
  // Shell operations
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  
  // File system
  writeFile: (filePath: string, data: string) => 
    ipcRenderer.invoke('fs:writeFile', filePath, data),
  readFile: (filePath: string) => 
    ipcRenderer.invoke('fs:readFile', filePath),
  
  // Update listeners
  onUpdateAvailable: (callback: () => void) => {
    ipcRenderer.on('update:available', callback);
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update:downloaded', callback);
  },
  installUpdate: () => ipcRenderer.invoke('update:install'),
});

// Type definitions
export interface ElectronAPI {
  getVersion: () => Promise<string>;
  getPath: (name: string) => Promise<string>;
  getMachineId: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  writeFile: (filePath: string, data: string) => Promise<{ success: boolean; error?: string }>;
  readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateDownloaded: (callback: () => void) => void;
  installUpdate: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
