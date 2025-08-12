const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { mouse, Point, straightTo, leftClick } = require('@nut-tree-fork/nut-js')

const isDev = !!process.env.VITE_DEV_SERVER_URL
let win

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'), // ★ 這行要對
    },
  })

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL) // e.g. http://localhost:5173
    // win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html')) // ★ 指向 dist
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

ipcMain.handle('automation:moveMouse', async (_e, x, y) => {
  await mouse.move(straightTo(new Point(x, y)))
})
ipcMain.handle('automation:click', async () => { await leftClick() })
