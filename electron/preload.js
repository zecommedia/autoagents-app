// Electron Preload Script - Bridge between Main and Renderer
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electron', {
  // Photoshop detection
  checkPhotoshop: () => ipcRenderer.invoke('check-photoshop'),

  // Process mockups with Photoshop (local)
  processMockupsPhotoshop: (data) => ipcRenderer.invoke('process-mockups-photoshop', data),

  // File operations
  saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),
  writeFile: (data) => ipcRenderer.invoke('write-file', data),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Platform detection
  platform: process.platform,
  isElectron: true
});

console.log('🔌 Electron preload script loaded');
