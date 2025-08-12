export {};

declare global {
  interface Window {
    electronAPI: {
      listNightcrowsWindows: () => Promise<{
        success: boolean;
        windows?: {
          title: string;
          region: { left: number; top: number; width: number; height: number };
        }[];
        error?: string;
      }>;
      bringWindowToFront: (region: {
        left: number;
        top: number;
        width: number;
        height: number;
      }) => Promise<{ success: boolean; error?: string }>;
      chooseSaveFolder: () => Promise<{
        success: boolean;
        path?: string;
        error?: string;
      }>;
      screenshotWindow: (
        region: { left: number; top: number; width: number; height: number },
        folder: string
      ) => Promise<{
        success: boolean;
        path?: string;
        dataUrl?: string;
        error?: string;
      }>;
    };
  }
}
