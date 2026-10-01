import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@printap/shared"] })],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../../packages/shared/src"),
        "@printap/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../../packages/shared/src"),
        "@printap/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
        "@renderer": path.resolve(__dirname, "src/renderer"),
      },
    },
  },
});
