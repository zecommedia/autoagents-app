// Electron Main Process
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const os = require('os');
const net = require('net');
const updater = require('./updater');

const execAsync = promisify(exec);

let mainWindow;
let viteProcess = null;

// Check if port is in use
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// Start Vite dev server
async function startDevServer() {
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) return;

  // Check if port 3000 is already in use
  const isPortFree = await checkPort(3000);
  if (!isPortFree) {
    console.log('📡 Dev server already running on port 3000');
    return;
  }

  console.log('🚀 Starting Vite dev server...');
  
  // Start Vite in background
  viteProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: 'pipe'
  });

  viteProcess.stdout.on('data', (data) => {
    console.log(`[Vite] ${data.toString().trim()}`);
  });

  viteProcess.stderr.on('data', (data) => {
    console.error(`[Vite Error] ${data.toString().trim()}`);
  });

  // Wait for server to be ready
  return new Promise((resolve) => {
    const checkServer = setInterval(async () => {
      try {
        const response = await fetch('http://localhost:3000');
        if (response.ok) {
          clearInterval(checkServer);
          console.log('✓ Vite dev server ready');
          resolve();
        }
      } catch (e) {
        // Server not ready yet
      }
    }, 500);
  });
}

// Create main window
async function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';
  
  // Start dev server in development mode
  if (isDev) {
    await startDevServer();
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/icon.png')
  });

  // Load React app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set main window reference for updater
  updater.setMainWindow(mainWindow);

  // Check for updates after window loads
  // 🧪 TESTING: Enabled in development mode to test with mock server
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      updater.checkForUpdates(false);
    }, 3000); // Wait 3 seconds before checking
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Kill Vite process when app closes
  if (viteProcess) {
    viteProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up on quit
app.on('quit', () => {
  if (viteProcess) {
    viteProcess.kill();
  }
});

// ============================================
// PHOTOSHOP DETECTION (Local Machine)
// ============================================

async function checkPhotoshopInstalled() {
  const photoshopPaths = [
    'C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe',
    'C:\\Program Files\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe',
    'C:\\Program Files\\Adobe\\Adobe Photoshop 2023\\Photoshop.exe',
    'C:\\Program Files\\Adobe\\Adobe Photoshop 2022\\Photoshop.exe',
    'C:\\Program Files\\Adobe\\Adobe Photoshop 2021\\Photoshop.exe',
    'C:\\Program Files\\Adobe\\Adobe Photoshop CC 2020\\Photoshop.exe',
    'C:\\Program Files\\Adobe\\Adobe Photoshop CC 2019\\Photoshop.exe',
    'C:\\Program Files\\Adobe\\Adobe Photoshop CC 2018\\Photoshop.exe',
    'C:\\Program Files (x86)\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe',
    'C:\\Program Files (x86)\\Adobe\\Adobe Photoshop 2023\\Photoshop.exe',
  ];

  for (const psPath of photoshopPaths) {
    try {
      await fs.access(psPath);
      console.log(`✓ Found Photoshop at: ${psPath}`);
      return { installed: true, path: psPath };
    } catch (e) {
      continue;
    }
  }

  // Try to find via 'where' command
  try {
    const { stdout } = await execAsync('where photoshop.exe', { timeout: 5000 });
    const foundPath = stdout.trim().split('\n')[0];
    if (foundPath && foundPath.endsWith('Photoshop.exe')) {
      console.log(`✓ Found Photoshop via 'where' command: ${foundPath}`);
      return { installed: true, path: foundPath };
    }
  } catch (e) {
    // Not found
  }

  console.log(`✗ Photoshop not found`);
  return { installed: false };
}

// ============================================
// PHOTOSHOP AUTOMATION (Local Execution)
// ============================================

async function executePhotoshopScript(photoshopPath, psdPath, podDesignPath, outputPath) {
  const jsxScriptPath = path.join(__dirname, 'scripts', 'replacesmartobject.jsx');

  // Check if JSX script exists
  try {
    await fs.access(jsxScriptPath);
  } catch (error) {
    throw new Error(`JSX script not found at: ${jsxScriptPath}`);
  }

  // Set environment variable with arguments
  const mockupArgs = `${psdPath}|${podDesignPath}|${outputPath}`;

  // Execute Photoshop with JSX script
  const command = `"${photoshopPath}" -r "${jsxScriptPath}"`;

  console.log(`Running Photoshop command: ${command}`);
  console.log(`MOCKUP_ARGS: ${mockupArgs}`);

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000, // 2 minutes timeout
      env: {
        ...process.env,
        MOCKUP_ARGS: mockupArgs
      }
    });

    console.log(`Photoshop stdout: ${stdout}`);
    if (stderr) console.warn(`Photoshop stderr: ${stderr}`);

    // Check if output file was created
    try {
      await fs.access(outputPath);
      console.log(`✓ Output file created: ${outputPath}`);
    } catch (error) {
      throw new Error(`Photoshop did not create output file: ${outputPath}`);
    }

    // Check for SUCCESS in output
    if (stdout.includes('SUCCESS')) {
      return { success: true, outputPath };
    } else if (stdout.includes('ERROR:')) {
      const errorMatch = stdout.match(/ERROR: (.+)/);
      const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error';
      throw new Error(`Photoshop script error: ${errorMsg}`);
    } else {
      console.warn('Photoshop output did not contain SUCCESS marker');
      return { success: true, outputPath };
    }
  } catch (error) {
    if (error.killed) {
      throw new Error('Photoshop execution timed out (2 minutes)');
    }
    throw error;
  }
}

// ============================================
// IPC HANDLERS
// ============================================

// Check Photoshop installation
ipcMain.handle('check-photoshop', async () => {
  try {
    const result = await checkPhotoshopInstalled();
    return result;
  } catch (error) {
    console.error('Photoshop check error:', error);
    return { installed: false, error: error.message };
  }
});

// Process mockups with Photoshop (local execution)
ipcMain.handle('process-mockups-photoshop', async (event, { podDesignPath, psdPaths }) => {
  try {
    // Check Photoshop
    const psCheck = await checkPhotoshopInstalled();
    if (!psCheck.installed) {
      throw new Error('Photoshop not found. Please install Adobe Photoshop.');
    }

    const processedImages = [];
    const tempDir = path.join(os.tmpdir(), 'mockup_' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    // Process each PSD
    for (const psdPath of psdPaths) {
      const psdName = path.basename(psdPath, path.extname(psdPath));
      const outputPath = path.join(tempDir, `${psdName}_processed.png`);

      console.log(`Processing ${psdName} with Photoshop...`);

      // Execute Photoshop script
      const result = await executePhotoshopScript(
        psCheck.path,
        psdPath,
        podDesignPath,
        outputPath
      );

      // Read processed file and convert to base64
      const imageBuffer = await fs.readFile(result.outputPath);
      const base64Data = imageBuffer.toString('base64');

      processedImages.push({
        filename: `${psdName}_processed.png`,
        data: `data:image/png;base64,${base64Data}`
      });

      console.log(`✓ Successfully processed ${psdName}`);
    }

    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    return {
      success: true,
      processedImages
    };
  } catch (error) {
    console.error('Photoshop processing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Open file dialog - Select single file
ipcMain.handle('select-file', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters || [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
    ],
    title: options.title || 'Select File'
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, filePath: null };
  }

  return { canceled: false, filePath: result.filePaths[0] };
});

// Open file dialog - Select multiple files
ipcMain.handle('select-files', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: options.filters || [
      { name: 'PSD Files', extensions: ['psd'] }
    ],
    title: options.title || 'Select Files'
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, filePaths: [] };
  }

  return { canceled: false, filePaths: result.filePaths };
});

// Save file dialog
ipcMain.handle('save-file-dialog', async (event, { defaultPath, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: filters || [{ name: 'PNG Images', extensions: ['png'] }]
  });
  return result;
});

// Write file
ipcMain.handle('write-file', async (event, { filePath, data }) => {
  try {
    // Remove data URL prefix if exists
    const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filePath, buffer);
    return { success: true };
  } catch (error) {
    console.error('Write file error:', error);
    return { success: false, error: error.message };
  }
});

// Get app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// ============================================
// AUTO-UPDATE IPC HANDLERS
// ============================================

// Check for updates manually
ipcMain.handle('check-for-updates', async () => {
  return await updater.checkForUpdates(true);
});

// Download update
ipcMain.handle('download-update', () => {
  updater.downloadUpdate();
});

// Install update
ipcMain.handle('install-update', () => {
  updater.quitAndInstall();
});

console.log('🚀 Electron main process started');
