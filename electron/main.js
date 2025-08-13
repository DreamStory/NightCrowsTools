// electron/main.js
// ------------------------------------------------------------
// 只做兩件事：建立視窗、提供「可擷取來源清單」給前端。
// 不再使用 getDisplayMedia 系統選單，也不做系統視窗聚焦。
// ------------------------------------------------------------
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron')
const path = require('path')

let win

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,                              // 讓 preload 能 require('electron')
      preload: path.join(__dirname, 'preload.js'), // 指向 electron/preload.js
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
  return win
}

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// === IPC：列出可擷取的來源（視窗/螢幕） ===
ipcMain.handle('capture:listSources', async () => {
  const srcs = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    fetchWindowIcons: true,
    thumbnailSize: { width: 360, height: 220 },
  })
  return srcs.map(s => ({
    id: s.id,
    name: s.name,
    thumbnailDataURL: s.thumbnail?.toDataURL() || '',
  }))
})
