"use strict";
const electron = require("electron");
async function getSourceIdByTitle(partialTitle) {
  const sources = await electron.desktopCapturer.getSources({
    types: ["window", "screen"],
    fetchWindowIcons: true,
    thumbnailSize: { width: 0, height: 0 }
  });
  let target = sources.find((s) => s.id.startsWith("window") && s.name.includes(partialTitle));
  if (!target) target = sources.find((s) => s.name.includes(partialTitle));
  return target?.id ?? null;
}
electron.contextBridge.exposeInMainWorld("electronAPI", {
  checkAndFocusNightCrows: () => electron.ipcRenderer.invoke("check-and-focus-nightcrows"),
  getSourceIdByTitle
});
