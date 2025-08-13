// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron')

console.log('[preload] loaded')

contextBridge.exposeInMainWorld('automation', {
  listSources: () => ipcRenderer.invoke('capture:listSources'),
})
