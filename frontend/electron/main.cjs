const { app, BrowserWindow, Menu, MenuItem, ipcMain, clipboard, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const yaml = require('js-yaml');
const semver = require('semver');

let mainWindow;
let tray;
let isQuitting = false;
let lastUpdateStatus = '';

const UPDATE_BASE_URL = 'https://emigrated.i234.me:3443/api/updates';
const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
const YAML_FILE = IS_MAC ? 'latest-mac.yml' : 'latest.yml';

const updateState = {
  available: null,       // parsed YAML info (full)
  archFile: null,        // { url, size } for current arch
  downloadPath: null,    // downloaded zip path
  extractPath: null,     // extracted app directory
  cancelled: false,      // user dismissed
};

// ====================== Update log ======================

function writeUpdateLog(msg) {
  try {
    const logPath = path.join(app.getPath('userData'), 'update-log.txt');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {
    console.error('Update log write failed:', e);
  }
}

// ====================== Helpers ======================

function sendUpdateStatus(text) {
  lastUpdateStatus = text;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', text);
  }
}

function sendUpdateError(text) {
  lastUpdateStatus = text;
  writeUpdateLog('ERROR: ' + text);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-error', text);
    mainWindow.webContents.send('update-status', text);
  }
}

// Extract a zip using macOS native ditto (handles non-ASCII filenames and
// symlinks correctly; extract-zip mis-decodes electron-builder zip filenames)
function extractWithDitto(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/ditto', ['-x', '-k', zipPath, destDir]);
    child.on('error', (err) => reject(new Error(`ditto 启动失败: ${err.message}`)));
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ditto 解压失败 (退出码 ${code})`));
    });
  });
}

function sendDownloadProgress(percent, bytesPerSecond, transferred, total) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-progress', {
      percent,
      bytesPerSecond,
      transferred,
      total,
    });
  }
}

// Select the correct zip for the current CPU architecture
function pickArchFile(info) {
  if (!info || !info.files || info.files.length === 0) {
    return { url: new URL(info.path, UPDATE_BASE_URL + '/').href, size: 0 };
  }
  const isArm64 = process.arch === 'arm64';
  if (isArm64) {
    const arm = info.files.find(f => f.url.includes('arm64'));
    if (arm) return { url: new URL(arm.url, UPDATE_BASE_URL + '/').href, size: arm.size || 0 };
  }
  // Default to first file (x64)
  return {
    url: new URL(info.files[0].url, UPDATE_BASE_URL + '/').href,
    size: info.files[0].size || 0,
  };
}

// ====================== Update Logic ======================

async function fetchLatestYaml() {
  const url = `${UPDATE_BASE_URL}/${YAML_FILE}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return yaml.load(text);
  } finally {
    clearTimeout(timer);
  }
}

async function checkForUpdate() {
  try {
    const info = await fetchLatestYaml();
    const currentVersion = app.getVersion();
    const latestVersion = info.version;

    if (semver.gt(latestVersion, currentVersion)) {
      const arch = pickArchFile(info);
      updateState.available = info;
      updateState.archFile = arch;
      return {
        hasUpdate: true,
        version: latestVersion,
        currentVersion,
        releaseDate: info.releaseDate || '',
        size: arch.size,
        downloadUrl: arch.url,
      };
    }
    return { hasUpdate: false };
  } catch (err) {
    console.error('Update check failed:', err);
    return { hasUpdate: false, error: err.message };
  }
}

async function downloadUpdate() {
  if (!updateState.available || !updateState.archFile) {
    sendUpdateStatus('没有可下载的更新');
    return;
  }

  const { version } = updateState.available;
  const { url: downloadUrl } = updateState.archFile;
  const tempDir = app.getPath('temp');
  const ext = IS_WIN ? '.exe' : '.zip';
  const filePath = path.join(tempDir, `ledo-update-${version}${ext}`);

  updateState.downloadPath = filePath;
  updateState.extractPath = null;
  updateState.cancelled = false;

  // Remove any leftover partial download
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  sendUpdateStatus('正在下载更新...');
  writeUpdateLog(`Download started: ${downloadUrl}`);

  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`下载失败: HTTP ${response.status}`);

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const reader = response.body.getReader();
    const fileStream = fs.createWriteStream(filePath);

    let received = 0;
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      fileStream.write(Buffer.from(value));

      const elapsed = (Date.now() - startTime) / 1000;
      const bytesPerSecond = elapsed > 0 ? Math.round(received / elapsed) : 0;
      const percent = contentLength > 0 ? Math.round((received / contentLength) * 100) : 0;

      sendDownloadProgress(percent, bytesPerSecond, received, contentLength);
    }

    await new Promise((resolve, reject) => {
      fileStream.end();
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    if (IS_MAC) {
      // macOS: extract .zip to get .app bundle
      sendUpdateStatus('下载完成，正在解压，请稍候...');
      writeUpdateLog(`Download complete (${received} bytes), extracting with ditto`);

      const extractDir = path.join(tempDir, `ledo-update-${version}`);
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
      fs.mkdirSync(extractDir, { recursive: true });

      await extractWithDitto(filePath, extractDir);
      writeUpdateLog(`Extraction complete: ${extractDir}`);

      updateState.extractPath = extractDir;
    } else {
      // Windows: installer .exe downloaded directly, no extraction needed
      updateState.extractPath = filePath; // store as extractPath for installUpdate
    }

    sendUpdateStatus('更新已就绪，请点击安装');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-ready');
    }
  } catch (err) {
    console.error('Download failed:', err);
    sendUpdateError(`下载失败: ${err.message}`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

// Install the downloaded update — macOS or Windows
async function installUpdate() {
  if (!updateState.extractPath) {
    sendUpdateError('没有可安装的更新');
    return;
  }

  writeUpdateLog('Install started, extractPath=' + updateState.extractPath);
  sendUpdateStatus('正在安装更新，应用即将重启...');

  if (IS_WIN) {
    // Windows: run NSIS installer silently
    const installerPath = updateState.extractPath; // .exe path
    if (!fs.existsSync(installerPath)) {
      sendUpdateError('错误：找不到安装程序');
      return;
    }

    // /S = silent install (no GUI)
    // /D=<path> = optional install dir override
    const child = spawn(installerPath, ['/S'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    isQuitting = true;
    app.quit();
    return;
  }

  // --- macOS: replace .app with new one, then relaunch ---
  const extractDir = updateState.extractPath;
  let appFiles;
  try {
    appFiles = fs.readdirSync(extractDir);
  } catch {
    sendUpdateError('错误：无法读取更新文件');
    return;
  }

  const appBundleName = appFiles.find(i => i.endsWith('.app'));
  if (!appBundleName) {
    sendUpdateError('错误：更新包中找不到应用');
    return;
  }

  const newAppPath = path.join(extractDir, appBundleName);

  // For a packaged macOS app, process.execPath looks like:
  //   /Applications/企业内部系统.app/Contents/MacOS/企业内部系统
  // The .app bundle is 3 levels up: Contents/MacOS/二进制 → Contents → .app
  const currentAppBundle = path.resolve(process.execPath, '..', '..', '..');
  if (!fs.existsSync(currentAppBundle)) {
    sendUpdateError('错误：找不到当前应用');
    return;
  }

  writeUpdateLog(`Replacing ${currentAppBundle} with ${newAppPath}`);

  // Shell script: wait for old app to quit, replace .app, relaunch
  const scriptPath = path.join(app.getPath('temp'), `ledo-update-${Date.now()}.sh`);
  const scriptContent = `#!/bin/bash
sleep 2
rm -rf "${currentAppBundle}"
cp -R "${newAppPath}" "$(dirname "${currentAppBundle}")/"
open "${currentAppBundle}"
`;

  fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });

  const child = spawn('/bin/bash', [scriptPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  isQuitting = true;
  app.quit();
}

// Check for update at startup; respects skip preference
async function autoCheckUpdate() {
  try {
    const userDataPath = app.getPath('userData');
    const prefPath = path.join(userDataPath, 'update-prefs.json');
    let skipVersion = null;
    if (fs.existsSync(prefPath)) {
      try {
        skipVersion = JSON.parse(fs.readFileSync(prefPath, 'utf-8')).skipVersion;
      } catch { /* ignore malformed */ }
    }

    const result = await checkForUpdate();
    if (result && result.hasUpdate && result.version !== skipVersion) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', result);
      }
    }
  } catch (err) {
    console.error('Auto update check failed:', err);
  }
}

// ====================== Tray ======================

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (process.platform === 'darwin') {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出系统',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('企业内部系统');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// ====================== IPC Handlers ======================

function setupIPC() {
  // Clipboard - write text
  ipcMain.handle('clipboard-write', (_event, text) => {
    clipboard.writeText(text);
    return true;
  });

  // Clipboard - read image (returns base64 PNG data URL or null)
  ipcMain.handle('clipboard-read-image', async () => {
    const image = clipboard.readImage();
    if (image && !image.isEmpty()) {
      // Get raw RGBA pixels, encode as PNG via nativeImage
      return image.toDataURL();
    }
    return null;
  });

  // Context menu - show native "粘贴" option, calls webContents.paste() on click
  // This triggers the paste event on the focused DOM element, which fires onPaste
  ipcMain.handle('clipboard-show-paste-menu', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    const menu = new Menu();
    menu.append(new MenuItem({
      label: '粘贴',
      accelerator: 'CmdOrCtrl+V',
      click: () => {
        // Paste into focused DOM element → triggers paste event → handleContainerPaste
        win.webContents.paste();
      }
    }));
    menu.popup({ window: win });
  });

  // Version
  ipcMain.handle('app-get-version', () => app.getVersion());

  // Window visibility
  ipcMain.handle('app-is-visible', () => {
    return mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized();
  });
  ipcMain.on('app-show', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
  ipcMain.on('app-hide', () => {
    if (mainWindow) mainWindow.hide();
  });
  // Restore window focus after native alert()/confirm() dialogs close
  // (Electron bug: https://github.com/electron/electron/issues/19977)
  ipcMain.on('focus-fix', () => {
    if (!mainWindow) return;
    mainWindow.blur();
    mainWindow.focus();
  });

  // ---- Update IPC ----

  // Renderer asks: is there an update?
  ipcMain.handle('check-for-update', async () => {
    return await checkForUpdate();
  });

  // Renderer says: start downloading
  ipcMain.on('start-download', () => {
    downloadUpdate();
  });

  // Renderer says: skip this version
  ipcMain.on('cancel-update', () => {
    const userDataPath = app.getPath('userData');
    const prefPath = path.join(userDataPath, 'update-prefs.json');
    fs.writeFileSync(prefPath, JSON.stringify({
      skipVersion: updateState.available?.version || null,
      skippedAt: new Date().toISOString(),
    }));
    updateState.cancelled = true;
    sendUpdateStatus('已跳过该版本更新');
  });

  // Renderer says: install and relaunch
  ipcMain.on('install-update', () => {
    installUpdate();
  });

  // Legacy: get last status text (for backward compat)
  ipcMain.handle('update-get-status', () => lastUpdateStatus || '');
}

// ====================== Window ======================

function createWindow() {
  Menu.setApplicationMenu(null);

  setupIPC();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'icon.png'),
    title: '企业内部系统',
  });

  mainWindow.setTitle('企业内部系统');
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  // Global context menu for input/editable elements (right-click: cut/copy/paste/selectAll)
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const { editFlags, isEditable, inputFieldType } = params;
    const isInput = inputFieldType !== 'none';
    // Only show menu on actual input fields or contentEditable areas
    if (!isEditable && !isInput) return;

    const menu = new Menu();
    if (editFlags.canCut) menu.append(new MenuItem({ label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' }));
    if (editFlags.canCopy) menu.append(new MenuItem({ label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' }));
    // Always show Paste for editable areas — supports both text and image paste
    // (canPaste can be false for image clipboard on text inputs, but webContents.paste() still works)
    menu.append(new MenuItem({ label: '粘贴', accelerator: 'CmdOrCtrl+V', click: () => { mainWindow.webContents.paste(); } }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }));
    menu.popup({ window: mainWindow });
  });

  // 点击窗口关闭按钮 → 完全退出客户端
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      isQuitting = true;
      app.quit();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ====================== App Lifecycle ======================

// Single instance lock - prevent multiple windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.on('ready', () => {
  createTray();
  createWindow();

  // Auto-check for updates after window finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(autoCheckUpdate, 3000);
  });
});

// Don't quit on window close (keep tray alive)
app.on('window-all-closed', () => {
  // 窗口全部关闭 → 完全退出客户端
  if (!isQuitting) isQuitting = true;
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
