/**
 * Remove the junk that accumulates when this project is edited inside OneDrive.
 *
 * Two kinds of leftover:
 *
 *  1. `vite.config.js.timestamp-*.mjs` — Vite writes one of these beside the
 *     config every time it loads it, and deletes it a moment later. When
 *     OneDrive has the file open for syncing, that delete fails silently and
 *     the file stays. They are harmless but they pile up fast.
 *
 *  2. Vite's dependency cache. Normally at `node_modules/.vite`; this project
 *     moves it to the OS temp directory (see vite.config.js), and both are
 *     cleared here so a stale cache can never be the problem.
 *
 * Run with:  npm run clean
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let removed = 0;

function remove(target, label) {
  try {
    if (!fs.existsSync(target)) return;
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 });
    removed++;
    console.log(`removed ${label}`);
  } catch (e) {
    // A locked file is exactly the situation this script exists for, so say so
    // plainly rather than failing with a stack trace.
    console.warn(`could not remove ${label} — ${e.code || e.message}`);
    console.warn("  Something has it open. Close the dev server and your editor, or pause OneDrive, then try again.");
  }
}

const stamps = fs.readdirSync(root).filter(f => /^vite\.config\.js\.timestamp-.*\.mjs$/.test(f));
for (const f of stamps) remove(path.join(root, f), f);
if (stamps.length) console.log(`${stamps.length} leftover vite config timestamp file(s)`);

// The in-tree cache is the one OneDrive locks, so it always goes.
remove(path.join(root, "node_modules", ".vite"), "node_modules/.vite");

// The out-of-tree cache is not the problem and clearing it makes the next build
// twice as slow, so it only goes when explicitly asked for.
if (process.argv.includes("--all")) {
  remove(path.join(os.tmpdir(), "vite-cache-bulkclock"), "the dependency cache (next build will be slower)");
}

console.log(removed ? `\nCleaned ${removed} item(s). Run npm run dev again.` : "\nNothing to clean.");
