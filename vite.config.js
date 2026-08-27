import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import os from "node:os";
import path from "node:path";

/**
 * Vite config.
 *
 * `cacheDir` is deliberately outside the project.
 *
 * This project lives inside a OneDrive folder, and OneDrive starts syncing a
 * file the moment it appears. Vite's dependency optimiser works by writing a
 * fresh `node_modules/.vite/deps_temp_*`, then deleting the old `deps` and
 * renaming the new one into place — and if OneDrive is holding a handle on any
 * file in there when that happens, the delete fails with:
 *
 *     Error: EPERM: operation not permitted, rmdir '…/node_modules/.vite/deps'
 *
 * and the dev server refuses to start. Putting the cache in the OS temp
 * directory takes it out of the synced tree entirely, so there is nothing for
 * OneDrive to hold on to. It also stops thousands of tiny cache files being
 * uploaded to the cloud on every install.
 *
 * The proper fix is to move the whole project out of OneDrive — see README —
 * but this makes it work where it is.
 */
const cacheDir = path.join(os.tmpdir(), "vite-cache-bulkclock");

export default defineConfig({
  plugins: [react()],
  cacheDir,

  // Capacitor serves the built app from the filesystem, so assets must be relative.
  base: "./",

  build: {
    outDir: "dist",
    target: "es2020",
    assetsInlineLimit: 0
  },

  server: {
    host: true,
    port: 5173,
    watch: {
      // Vite writes a temporary vite.config.js.timestamp-*.mjs beside this file
      // every time it loads the config, and deletes it immediately afterwards.
      // On OneDrive that delete sometimes fails silently and the file is left
      // behind; ignoring them here at least stops each one triggering a reload.
      ignored: ["**/vite.config.js.timestamp-*.mjs", "**/dist/**", "**/android/**"]
    }
  },

  // Keep errors on screen instead of clearing them away on every restart.
  clearScreen: false
});
