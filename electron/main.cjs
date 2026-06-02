const { app, BrowserWindow, shell } = require('electron');
app.name = 'CumpliSent';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerCumplimientosHandlers } = require('./backend/ipc.cjs');
const { registerAuthHandlers } = require('./backend/auth-ipc.cjs');
const { registerMesasHandlers } = require('./backend/mesas-ipc.cjs');

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const cacheDir = path.join(os.tmpdir(), 'cumplisent-cache');
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.exit(0);
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
    title: 'CumpliSent',
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
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
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

function productionDatabasePath() {
  return path.join(app.getPath('userData'), 'backend', 'sistema-control.sqlite');
}

function removeFileIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  } catch (error) {
    console.error(`Error removing database sidecar ${filePath}:`, error);
  }
}

function backupFileIfExists(filePath, stamp) {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }

    fs.renameSync(filePath, `${filePath}.invalid-${stamp}`);
  } catch (error) {
    console.error(`Error backing up invalid database file ${filePath}:`, error);
  }
}

function validateSqliteFile(filePath) {
  const { DatabaseSync } = require('node:sqlite');
  let database;

  try {
    database = new DatabaseSync(filePath);
    const row = database.prepare('PRAGMA integrity_check').get();
    const result = row ? Object.values(row)[0] : null;
    return result === 'ok';
  } finally {
    try {
      database?.close?.();
    } catch {}
  }
}

function prepareDatabaseFiles() {
  const dbPath = productionDatabasePath();
  const dbDir = path.dirname(dbPath);
  const sidecars = [`${dbPath}-wal`, `${dbPath}-shm`];

  fs.mkdirSync(dbDir, { recursive: true });

  if (!fs.existsSync(dbPath)) {
    sidecars.forEach(removeFileIfExists);
    return;
  }

  try {
    if (validateSqliteFile(dbPath)) {
      return;
    }
  } catch (error) {
    console.error('Database validation failed before startup:', error);
  }

  const hadSidecars = sidecars.some((filePath) => fs.existsSync(filePath));
  if (hadSidecars) {
    sidecars.forEach(removeFileIfExists);

    try {
      if (validateSqliteFile(dbPath)) {
        return;
      }
    } catch (error) {
      console.error('Database validation failed after sidecar cleanup:', error);
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  [dbPath, ...sidecars].forEach((filePath) => backupFileIfExists(filePath, stamp));
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
    const prodDbPath = productionDatabasePath();
    
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
  prepareDatabaseFiles();
  migrateDevDatabase();
  prepareDatabaseFiles();
  registerCumplimientosHandlers();
  registerAuthHandlers();
  registerMesasHandlers();
  createWindow();

  // Run initial daily work cleanup and schedule periodic runs
  try {
    const { flushTrabajoDiarioToHistory } = require('./backend/mesas-store.cjs');
    const safeFlushTrabajoDiarioToHistory = () => {
      try {
        flushTrabajoDiarioToHistory();
      } catch (error) {
        console.error('Error running daily work flush:', error);
      }
    };

    setImmediate(safeFlushTrabajoDiarioToHistory);
    setInterval(safeFlushTrabajoDiarioToHistory, 60 * 60 * 1000);
  } catch (err) {
    console.error('Error initializing daily work flush schedule:', err);
  }

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
