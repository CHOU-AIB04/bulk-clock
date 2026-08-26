/**
 * Where the app's state actually lives.
 *
 * localStorage was fine while a log was a few kilobytes. It is the wrong home for
 * a year of meals, sets and measurements: Android's WebView can evict it under
 * storage pressure, it caps out around 5 MB, and every write is synchronous on
 * the main thread — which, with a save on every keystroke, is a stutter you can
 * feel while typing a weight.
 *
 * So on device the state is a JSON file in the app's private data directory,
 * written on a debounce and flushed when the app goes to the background. On the
 * web it stays in localStorage, which is all a browser offers anyway.
 *
 * Reads try the file first and fall back to localStorage, which doubles as the
 * one-time migration path for anyone upgrading from an older build.
 */

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";

const LS_KEY = "bulkclock.state.v1";
const DIR = "bulkclock";
const FILE = `${DIR}/state.json`;

export const isNative = () => Capacitor.isNativePlatform();

/* ── reading ─────────────────────────────────────────────── */

function readLocal() {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

/**
 * The saved state as a JSON string, or null on a fresh install.
 * Never throws — a corrupt store must not stop the app from opening.
 */
export async function readSnapshot() {
  if (isNative()) {
    try {
      const res = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
      if (res?.data) return res.data;
    } catch {
      /* no file yet — fall through to the localStorage migration path */
    }
    const legacy = readLocal();
    if (legacy) {
      // First launch after the upgrade: copy it across, then leave the old copy
      // alone until the new file has been read back successfully at least once.
      await writeNow(legacy);
      return legacy;
    }
    return null;
  }
  return readLocal();
}

/* ── writing ─────────────────────────────────────────────── */

let pending = null;
let timer = null;
let writing = false;
let lastError = null;

async function ensureDir() {
  try {
    await Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true });
  } catch {
    /* already there */
  }
}

async function writeNow(json) {
  if (!isNative()) {
    try {
      localStorage.setItem(LS_KEY, json);
      lastError = null;
    } catch (e) {
      lastError = e;
    }
    return;
  }
  try {
    await ensureDir();
    await Filesystem.writeFile({ path: FILE, directory: Directory.Data, data: json, encoding: Encoding.UTF8 });
    lastError = null;
    // Keep a small mirror so a reinstall-free downgrade still finds something.
    try {
      if (json.length < 2_000_000) localStorage.setItem(LS_KEY, json);
    } catch {
      /* mirror is a nicety, not a requirement */
    }
  } catch (e) {
    lastError = e;
  }
}

/**
 * Queue a save. Rapid edits — typing a weight, dragging a slider — collapse into
 * one write rather than one per character.
 */
export function writeSnapshot(json) {
  pending = json;
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    if (writing || pending == null) return;
    const json2 = pending;
    pending = null;
    writing = true;
    await writeNow(json2);
    writing = false;
    if (pending != null) writeSnapshot(pending);   // something changed mid-write
  }, 450);
}

/** Write immediately — used when the app is about to be backgrounded or closed. */
export async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending == null) return;
  const json = pending;
  pending = null;
  await writeNow(json);
}

export function persistError() {
  return lastError;
}

/** Wire the flush to every way an app can lose the foreground. */
export function installFlushHooks() {
  const onHide = () => { if (document.visibilityState === "hidden") flush(); };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
}
