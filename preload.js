const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  listNightcrowsWindows: () => ipcRenderer.invoke('list-nightcrows-windows'),
  bringWindowToFront: (region) => ipcRenderer.invoke('bring-window-to-front', region),
  chooseSaveFolder: () => ipcRenderer.invoke('choose-save-folder'),
  screenshotWindow: (region, folder) => ipcRenderer.invoke('screenshot-window', { region, folder }),
});
