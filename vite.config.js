import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Capacitor serves the built app from the filesystem, so assets must be relative.
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    assetsInlineLimit: 0
  },
  server: { host: true, port: 5173 }
});
