// Auto-updater module for Electron app
const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('Auto-updater initialized');

// Configure updater
autoUpdater.autoDownload = false; // Ask user before downloading
autoUpdater.autoInstallOnAppQuit = true; // Auto install when app quits

// 🧪 DEVELOPMENT: Use mock update server for testing
// Comment out for production
const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  // Force updates in development mode
  autoUpdater.forceDevUpdateConfig = true;
  
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'http://localhost:5555'
  });
  log.info('🧪 Using mock update server: http://localhost:5555');
  log.info('🧪 Forced dev update config enabled');
}

let updateCheckInProgress = false;
let mainWindow = null;

/**
 * Set main window reference for dialogs
 */
function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Check for updates
 */
async function checkForUpdates(showNoUpdateDialog = false) {
  if (updateCheckInProgress) {
    log.info('Update check already in progress');
    return;
  }

  try {
    updateCheckInProgress = true;
    log.info('Checking for updates...');
    
    const result = await autoUpdater.checkForUpdates();
    
    if (showNoUpdateDialog && result.updateInfo.version === autoUpdater.currentVersion.version) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Không có cập nhật',
        message: 'Bạn đang sử dụng phiên bản mới nhất!',
        buttons: ['OK']
      });
    }
    
    return result;
  } catch (error) {
    log.error('Error checking for updates:', error);
    
    if (showNoUpdateDialog) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Lỗi kiểm tra cập nhật',
        message: 'Không thể kiểm tra cập nhật. Vui lòng thử lại sau.',
        detail: error.message,
        buttons: ['OK']
      });
    }
  } finally {
    updateCheckInProgress = false;
  }
}

/**
 * Download update
 */
function downloadUpdate() {
  log.info('Starting update download...');
  autoUpdater.downloadUpdate();
}

/**
 * Quit and install update
 */
function quitAndInstall() {
  log.info('Quitting and installing update...');
  autoUpdater.quitAndInstall(false, true);
}

// ============================================
// Auto-updater Events
// ============================================

autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
  if (mainWindow) {
    mainWindow.webContents.send('update-checking');
  }
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info.version);
  
  if (mainWindow) {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate
    });
  }

  // Show dialog
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Có bản cập nhật mới! 🎉',
    message: `Phiên bản ${info.version} đã có sẵn`,
    detail: `Phiên bản hiện tại: ${autoUpdater.currentVersion.version}\n\nBạn có muốn tải về và cài đặt?`,
    buttons: ['Tải về ngay', 'Xem chi tiết', 'Để sau'],
    defaultId: 0,
    cancelId: 2
  }).then((result) => {
    if (result.response === 0) {
      // Download now
      downloadUpdate();
    } else if (result.response === 1) {
      // View details - open release notes
      const { shell } = require('electron');
      shell.openExternal(`https://github.com/zecommedia/autoagents-app/releases/tag/v${info.version}`);
    }
  });
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available. Current version is:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-not-available');
  }
});

autoUpdater.on('error', (error) => {
  log.error('Error in auto-updater:', error);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', error.message);
  }
});

autoUpdater.on('download-progress', (progress) => {
  const logMessage = `Download speed: ${progress.bytesPerSecond} - Downloaded ${progress.percent}% (${progress.transferred}/${progress.total})`;
  log.info(logMessage);
  
  if (mainWindow) {
    mainWindow.webContents.send('update-download-progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info.version);
  
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', {
      version: info.version
    });
  }

  // Show dialog
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Cập nhật đã sẵn sàng! ✅',
    message: `Phiên bản ${info.version} đã được tải về`,
    detail: 'Ứng dụng sẽ khởi động lại để cài đặt bản cập nhật.',
    buttons: ['Khởi động lại ngay', 'Để sau'],
    defaultId: 0
  }).then((result) => {
    if (result.response === 0) {
      quitAndInstall();
    }
  });
});

module.exports = {
  setMainWindow,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  autoUpdater
};
