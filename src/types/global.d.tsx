export { }

declare global {
  interface Window {
    automation: {
      listWindows: () => Promise<{ id: string; name: string; thumbnailDataURL: string }[]>
      moveMouse: (x: number, y: number) => Promise<void>
      click: () => Promise<void>
    }
  }
}
