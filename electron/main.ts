import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    backgroundColor: '#1a1a1a',
    show: false, // Don't show until ready
    frame: true,
    titleBarStyle: 'default',
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from dist folder
    // When packaged, __dirname will be in resources/app.asar/electron-build
    // We need to go up to resources/app.asar and then to dist
    const distPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html')
      : path.join(__dirname, '../dist/index.html');
    
    mainWindow.loadFile(distPath);
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    // Open DevTools to debug
    mainWindow?.webContents.openDevTools();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Cleanup
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPath', (event, name: string) => {
  return app.getPath(name as any);
});

ipcMain.handle('shell:openExternal', (event, url: string) => {
  return shell.openExternal(url);
});

// Machine ID generation
ipcMain.handle('system:getMachineId', async () => {
  const os = require('os');
  const crypto = require('crypto');
  
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  const cpus = os.cpus()[0]?.model || 'unknown';
  
  const machineString = `${hostname}-${platform}-${arch}-${cpus}`;
  const hash = crypto.createHash('sha256').update(machineString).digest('hex');
  
  return `machine-${hash.substring(0, 16)}`;
});

// File system operations
ipcMain.handle('fs:writeFile', async (event, filePath: string, data: string) => {
  const fs = require('fs').promises;
  try {
    await fs.writeFile(filePath, data, 'utf-8');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:readFile', async (event, filePath: string) => {
  const fs = require('fs').promises;
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Auto-updater (optional)
if (process.env.NODE_ENV === 'production') {
  const { autoUpdater } = require('electron-updater');
  
  autoUpdater.checkForUpdatesAndNotify();
  
  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update:available');
  });
  
  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:downloaded');
  });
  
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall();
  });
}
