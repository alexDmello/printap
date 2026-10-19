import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import path from "path";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://pjwystvflmigolgtlpow.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqd3lzdHZmbG1pZ29sZ3RscG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1ODg1MTUsImV4cCI6MjEwNjE2NDUxNX0.iKjgSkyHJYQVnCkDgYPQHwwqykPJ_Ev7KQJhMiSkips";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@printap/shared"] })],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../../packages/shared/src"),
        "@printap/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      },
    },
    define: {
      "process.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
      "process.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(SUPABASE_ANON_KEY),
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
        "@printap/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
        "@renderer": path.resolve(__dirname, "src/renderer"),
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(SUPABASE_ANON_KEY),
      "process.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
      "process.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(SUPABASE_ANON_KEY),
    },
  },
});
