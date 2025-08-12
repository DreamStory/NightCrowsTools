const { contextBridge, desktopCapturer, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('automation', {
  listWindows: async () => {
    const raw = await desktopCapturer.getSources({
      types: ['window'],
      fetchWindowIcons: true,
      thumbnailSize: { width: 320, height: 180 }
    })
    // 先不過濾，等看到實際標題再過濾 NIGHT CROWS
    return raw.map(s => ({
      id: s.id,
      name: s.name,
      thumbnailDataURL: s.thumbnail.toDataURL()
    }))
  },
  moveMouse: (x, y) => ipcRenderer.invoke('automation:moveMouse', x, y),
  click: () => ipcRenderer.invoke('automation:click')
})
