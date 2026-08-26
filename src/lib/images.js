/**
 * Pictures the user takes: meal photos, the profile avatar, progress shots.
 *
 * Three rules shape this file.
 *
 * 1. Photos never leave the phone. There is no upload, no CDN, no account —
 *    same promise the rest of the app makes about your data.
 * 2. A 12-megapixel camera photo is ~4 MB and useless at the size it is shown.
 *    Everything is downscaled and re-encoded before it is stored, which keeps a
 *    year of meal photos in the tens of megabytes rather than the thousands.
 * 3. Storage is content-addressed by an id we mint, so deleting a meal can
 *    delete its photo without hunting through the filesystem.
 */

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

const DIR = "bulkclock/img";
const WEB_PREFIX = "bulkclock.img.";

const isNative = () => Capacitor.isNativePlatform();

/** Longest edge, in pixels, per use. Avatars are small; progress shots are not. */
export const SIZES = { avatar: 320, meal: 720, progress: 1280 };

/* ── capture ─────────────────────────────────────────────── */

/**
 * Ask for a picture. Uses the native camera/gallery picker where there is one
 * and a plain file input in the browser, so the same call works in both.
 * Resolves to a data URL, or null when the user backs out.
 */
export async function pickImage({ source = "prompt", size = SIZES.meal } = {}) {
  if (isNative()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const photo = await Camera.getPhoto({
        quality: 88,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        width: size,
        correctOrientation: true,
        source: source === "camera" ? CameraSource.Camera
          : source === "gallery" ? CameraSource.Photos
            : CameraSource.Prompt,
        promptLabelHeader: "Add a photo",
        promptLabelPhoto: "Choose from gallery",
        promptLabelPicture: "Take a picture"
      });
      if (!photo?.dataUrl) return null;
      return downscale(photo.dataUrl, size);
    } catch {
      return null;   // cancelled, or permission refused
    }
  }
  return pickFromFileInput(size);
}

function pickFromFileInput(size) {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);

    // "cancel" is not reliably fired everywhere, so the element is cleaned up on
    // the next interaction rather than being left in the DOM forever.
    const cleanup = () => { input.remove(); };

    input.onchange = () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => downscale(String(reader.result), size).then(resolve).catch(() => resolve(null));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.oncancel = () => { cleanup(); resolve(null); };
    input.click();
  });
}

/** Re-encode to JPEG with the longest edge capped, preserving aspect ratio. */
export function downscale(dataUrl, maxEdge = SIZES.meal, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error("could not read that image"));
    img.src = dataUrl;
  });
}

/* ── storing ─────────────────────────────────────────────── */

const uid = () => "img_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const base64Of = dataUrl => dataUrl.slice(dataUrl.indexOf(",") + 1);

async function ensureDir() {
  try {
    await Filesystem.mkdir({ path: DIR, directory: Directory.Data, recursive: true });
  } catch {
    /* already there */
  }
}

/**
 * Persist a data URL and return the id to store alongside the meal or profile.
 * Returns null if it could not be written, so callers can keep the old photo
 * rather than saving a reference to nothing.
 */
export async function saveImage(dataUrl, id = uid()) {
  if (!dataUrl) return null;
  if (isNative()) {
    try {
      await ensureDir();
      await Filesystem.writeFile({ path: `${DIR}/${id}.jpg`, directory: Directory.Data, data: base64Of(dataUrl) });
      cache.set(id, null);   // force a re-resolve of the src
      return id;
    } catch {
      return null;
    }
  }
  try {
    localStorage.setItem(WEB_PREFIX + id, dataUrl);
    cache.set(id, dataUrl);
    return id;
  } catch {
    return null;   // quota — the caller shows "couldn't save that photo"
  }
}

export async function deleteImage(id) {
  if (!id) return;
  cache.delete(id);
  if (isNative()) {
    try {
      await Filesystem.deleteFile({ path: `${DIR}/${id}.jpg`, directory: Directory.Data });
    } catch {
      /* already gone */
    }
    return;
  }
  try {
    localStorage.removeItem(WEB_PREFIX + id);
  } catch {
    /* ignore */
  }
}

/* ── reading ─────────────────────────────────────────────── */

const cache = new Map();
const inflight = new Map();

/** A src usable in an <img>, or null while it resolves / if it is gone. */
export function imageSrcSync(id) {
  if (!id) return null;
  return cache.get(id) || null;
}

export async function imageSrc(id) {
  if (!id) return null;
  const hit = cache.get(id);
  if (hit) return hit;
  if (inflight.has(id)) return inflight.get(id);

  const job = (async () => {
    if (isNative()) {
      try {
        const { uri } = await Filesystem.getUri({ path: `${DIR}/${id}.jpg`, directory: Directory.Data });
        const src = Capacitor.convertFileSrc(uri);
        cache.set(id, src);
        return src;
      } catch {
        return null;
      } finally {
        inflight.delete(id);
      }
    }
    try {
      const src = localStorage.getItem(WEB_PREFIX + id);
      if (src) cache.set(id, src);
      return src;
    } catch {
      return null;
    } finally {
      inflight.delete(id);
    }
  })();

  inflight.set(id, job);
  return job;
}

/** Every stored image id, so orphans can be swept after deletions. */
export async function listImageIds() {
  if (isNative()) {
    try {
      const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Data });
      return files.map(f => (typeof f === "string" ? f : f.name)).filter(n => n.endsWith(".jpg")).map(n => n.slice(0, -4));
    } catch {
      return [];
    }
  }
  try {
    return Object.keys(localStorage).filter(k => k.startsWith(WEB_PREFIX)).map(k => k.slice(WEB_PREFIX.length));
  } catch {
    return [];
  }
}

/** Delete stored images nothing points at any more. */
export async function sweepOrphans(keepIds) {
  const keep = new Set(keepIds.filter(Boolean));
  const all = await listImageIds();
  let removed = 0;
  for (const id of all) {
    if (!keep.has(id)) {
      await deleteImage(id);
      removed++;
    }
  }
  return removed;
}
