const { app, BrowserWindow, shell } = require('electron');
const os = require('node:os');
const path = require('node:path');
const { registerCumplimientosHandlers } = require('./backend/ipc.cjs');
const { registerAuthHandlers } = require('./backend/auth-ipc.cjs');

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const cacheDir = path.join(os.tmpdir(), 'cumplisent-cache');
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

let mainWindow;

function createWindow() {
  const iconPath = path.resolve(__dirname, '..', 'Images', 'Cumplisent.ico');
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setIcon(iconPath);
  mainWindow.maximize();
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.on('second-instance', () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
});

function migrateDevDatabase() {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const prodUserData = app.getPath('userData');
    const prodDbPath = path.join(prodUserData, 'backend', 'sistema-control.sqlite');
    
    if (fs.existsSync(prodDbPath)) {
      console.log('Production database already exists. Skipping migration.');
      return;
    }
    
    const appData = app.getPath('appData');
    const devPaths = [
      path.join(appData, '@figma', 'my-make-file', 'backend', 'sistema-control.sqlite'),
      path.join(appData, 'Electron', 'backend', 'sistema-control.sqlite'),
      path.join(appData, 'cumplimientos-electron-app', 'backend', 'sistema-control.sqlite')
    ];
    
    for (const devPath of devPaths) {
      if (fs.existsSync(devPath)) {
        fs.mkdirSync(path.dirname(prodDbPath), { recursive: true });
        fs.copyFileSync(devPath, prodDbPath);
        console.log(`Successfully migrated database from ${devPath} to ${prodDbPath}`);
        
        if (fs.existsSync(devPath + '-wal')) {
          fs.copyFileSync(devPath + '-wal', prodDbPath + '-wal');
        }
        if (fs.existsSync(devPath + '-shm')) {
          fs.copyFileSync(devPath + '-shm', prodDbPath + '-shm');
        }
        break;
      }
    }
  } catch (error) {
    console.error('Error during database migration:', error);
  }
}

app.whenReady().then(() => {
  migrateDevDatabase();
  registerCumplimientosHandlers();
  registerAuthHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Stop API server if running
    try {
      const { stopServer } = require('./backend/api-server.cjs');
      stopServer().catch(() => {});
    } catch {}
    app.quit();
  }
});
