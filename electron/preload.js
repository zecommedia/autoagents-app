// Electron Preload Script - Bridge between Main and Renderer
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electron', {
  // Photoshop detection
  checkPhotoshop: () => ipcRenderer.invoke('check-photoshop'),

  // Process mockups with Photoshop (local)
  processMockupsPhotoshop: (data) => ipcRenderer.invoke('process-mockups-photoshop', data),

  // File dialog operations
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  selectFiles: (options) => ipcRenderer.invoke('select-files', options),
  saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),
  writeFile: (data) => ipcRenderer.invoke('write-file', data),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', callback),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, error) => callback(error)),

  // Platform detection
  platform: process.platform,
  isElectron: true
});

console.log('🔌 Electron preload script loaded');
