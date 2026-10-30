const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronClipboard', {
  writeText: (text) => ipcRenderer.invoke('clipboard-write', text),
  readImage: () => ipcRenderer.invoke('clipboard-read-image'),
  showPasteMenu: () => ipcRenderer.invoke('clipboard-show-paste-menu')
});

contextBridge.exposeInMainWorld('electronUpdater', {
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  startDownload: () => ipcRenderer.send('start-download'),
  cancelUpdate: () => ipcRenderer.send('cancel-update'),
  installUpdate: () => ipcRenderer.send('install-update'),

  onStatus: (callback) => {
    const handler = (_event, msg) => callback(msg);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },

  onProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },

  onUpdateReady: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('update-ready', handler);
    return () => ipcRenderer.removeListener('update-ready', handler);
  },

  onError: (callback) => {
    const handler = (_event, msg) => callback(msg);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },

  onUpdateAvailable: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },

  getStatus: () => ipcRenderer.invoke('update-get-status')
});

contextBridge.exposeInMainWorld('electronApp', {
  isElectron: true,
  isWindowVisible: () => ipcRenderer.invoke('app-is-visible'),
  showWindow: () => ipcRenderer.send('app-show'),
  hideWindow: () => ipcRenderer.send('app-hide'),
  getVersion: () => ipcRenderer.invoke('app-get-version')
});

// ---- Electron alert/confirm focus fix ----
// Known Electron bug: after a native alert()/confirm() dialog closes, the window
// does not regain focus, making all inputs unclickable until the window is
// refocused (https://github.com/electron/electron/issues/19977, #31917, #41603).
// Workaround: blur()+focus() the window right after the dialog closes.
contextBridge.exposeInMainWorld('electronFocusFix', {
  fix: () => ipcRenderer.send('focus-fix')
});

if (typeof contextBridge.executeInMainWorld === 'function') {
  contextBridge.executeInMainWorld({
    func: () => {
      const origAlert = window.alert;
      const origConfirm = window.confirm;
      window.alert = (message) => {
        origAlert(String(message));
        window.electronFocusFix && window.electronFocusFix.fix();
      };
      window.confirm = (message) => {
        const result = origConfirm(String(message));
        window.electronFocusFix && window.electronFocusFix.fix();
        return result;
      };
    }
  });
}
