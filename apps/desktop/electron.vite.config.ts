import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../../packages/shared/src"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../../packages/shared/src"),
        "@renderer": path.resolve(__dirname, "src/renderer"),
      },
    },
  },
});
