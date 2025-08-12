import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./", // ★ 這行很關鍵：讓 dist/index.html 內資源用相對路徑
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
