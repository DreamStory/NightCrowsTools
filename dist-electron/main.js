"use strict";
const electron = require("electron");
const path = require("node:path");
let win = null;
const createWindow = () => {
  win = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      // 由外掛在 dev/build 時產出
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (!electron.app.isPackaged) {
    win.loadURL("http://localhost:5173/");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
};
electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.handle("check-and-focus-nightcrows", async () => {
  const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

$wins = Get-Process | Where-Object { $_.MainWindowTitle -match 'NIGHT CROWS' } | Select-Object -First 1
if ($wins) {
  $h = $wins.MainWindowHandle
  if ([Win32]::IsIconic($h)) { [Win32]::ShowWindowAsync($h, 9) | Out-Null }  # SW_RESTORE = 9
  [Win32]::SetForegroundWindow($h) | Out-Null
  Write-Output "FOCUSED"
} else {
  Write-Output "NOTFOUND"
}
  `.trim();
  return new Promise() < { found: boolean, focused: boolean } > ((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
      windowsHide: true
    });
    let out = "";
    child.stdout.on("data", (d) => out += d.toString());
    child.on("exit", () => {
      if (out.includes("FOCUSED")) resolve({ found: true, focused: true });
      else resolve({ found: false });
    });
    child.on("error", () => resolve({ found: false }));
  });
});
