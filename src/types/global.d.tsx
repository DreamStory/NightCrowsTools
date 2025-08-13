export { }
declare global {
  interface Window {
    automation: {
      // 新
      listSources: () => Promise<{ id: string; name: string; thumbnailDataURL: string }[]>
      listSystemWindows: () => Promise<{ hwnd: number; title: string; bounds: { x: number; y: number; width: number; height: number }; processId: number; className: string }[]>
      listDisplays: () => Promise<{ id: number; name: string; bounds: { x: number; y: number; width: number; height: number }; scaleFactor: number }[]>

      // 既有
      moveMouse: (x: number, y: number) => Promise<void>
      click: () => Promise<void>
      resolveWindowByTitle: (title: string) => Promise<{ hwnd: number; title: string; bounds: { x: number; y: number; width: number; height: number } } | null>
      focusWindow: (hwnd: number) => Promise<boolean>
    }
  }
}
