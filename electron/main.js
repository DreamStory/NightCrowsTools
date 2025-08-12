const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  getWindows, getActiveWindow, keyboard, Key,
  screen, mouse, Point,
} = require('@nut-tree-fork/nut-js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: { preload: path.join(__dirname, '../preload.js'), contextIsolation: true },
  });
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL(`file://${path.join(__dirname, '../dist/index.html')}`);
  }
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

screen.config.resourceDirectory = path.join(os.tmpdir(), 'nutjs');

const sameRegion = (a, b) =>
  a && b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

// 只列出 NIGHT CROWS
ipcMain.handle('list-nightcrows-windows', async () => {
  try {
    const wins = await getWindows();
    const out = [];
    for (const w of wins) {
      try {
        const title = (await w.getTitle())?.trim();
        if (!title || !/night\s*crows/i.test(title)) continue;
        const region = await w.region;
        if (!out.some(x => x.title === title && sameRegion(x.region, region))) {
          out.push({ title, region });
        }
      } catch {}
    }
    if (out.length === 0) return { success: false, error: '畫面中沒有 NIGHT CROWS 視窗' };
    return { success: true, windows: out };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 聚焦（bringToTop → Alt+Tab 備援 → 點標題列）
ipcMain.handle('bring-window-to-front', async (_e, region) => {
  try {
    const wins = await getWindows();
    let target = null, targetTitle = null;
    for (const w of wins) {
      const r = await w.region;
      if (sameRegion(r, region)) { target = w; break; }
    }
    if (!target) return { success: false, error: '找不到對應的視窗' };

    try {
      if (typeof target.bringToTop === 'function') { await target.bringToTop(); return { success: true }; }
    } catch {}

    targetTitle = (await target.getTitle())?.trim() || null;
    if (!targetTitle) return { success: false, error: '無視窗標題可比對' };

    const MAX_SWAPS = 20;
    await keyboard.pressKey(Key.LeftAlt);
    for (let i = 0; i < MAX_SWAPS; i++) {
      await keyboard.tapKey(Key.Tab);
      await new Promise(r => setTimeout(r, 180));
      const active = await getActiveWindow();
      const activeTitle = (await active.getTitle())?.trim() || '';
      if (activeTitle === targetTitle) { await keyboard.releaseKey(Key.LeftAlt); return { success: true }; }
    }
    await keyboard.releaseKey(Key.LeftAlt);

    // 退而求其次：點標題列中央
    const r = await target.region;
    const titleY = r.top + Math.max(10, Math.min(40, Math.floor(r.height * 0.03)));
    const titleX = r.left + Math.floor(r.width * 0.5);
    await mouse.setPosition(new Point(titleX, titleY));
    await mouse.leftClick();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 選擇資料夾
ipcMain.handle('choose-save-folder', async () => {
  try {
    const res = await dialog.showOpenDialog({ title: '選擇要儲存的資料夾', properties: ['openDirectory'] });
    if (res.canceled || res.filePaths.length === 0) return { success: false, error: '使用者取消選擇' };
    return { success: true, path: res.filePaths[0] };
  } catch (err) { return { success: false, error: err.message }; }
});

// 只擷取該視窗範圍
ipcMain.handle('screenshot-window', async (_e, { region, folder }) => {
  try {
    if (!region) throw new Error('缺少 region');
    if (!folder) throw new Error('尚未選擇儲存資料夾');
    const image = await screen.grabRegion(region);
    const buf = image.toPNG();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(folder, `nightcrows-${ts}.png`);
    fs.writeFileSync(filePath, buf);
    const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    return { success: true, path: filePath, dataUrl };
  } catch (err) { return { success: false, error: err.message }; }
});
