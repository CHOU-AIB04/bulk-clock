/**
 * Touch feedback.
 *
 * Small thing, disproportionate effect: a hybrid app that answers a tap with a
 * physical tick stops feeling like a web page in a frame. Used sparingly — a
 * buzz on every interaction is worse than none.
 *
 * Everything here fails silently. Haptics are a nicety and must never be able to
 * break a save, and the browser fallback (navigator.vibrate) is missing on iOS
 * Safari and ignored on desktop by design.
 */

import { Capacitor } from "@capacitor/core";

let plugin = null;
let unavailable = false;

async function haptics() {
  if (unavailable) return null;
  if (plugin) return plugin;
  try {
    const mod = await import("@capacitor/haptics");
    plugin = mod;
    return plugin;
  } catch {
    unavailable = true;
    return null;
  }
}

const native = () => Capacitor.isNativePlatform();

function webBuzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* blocked or unsupported */
  }
}

/** A set ticked, a check-in answered — the everyday confirmation. */
export async function tapLight() {
  if (!native()) return webBuzz(12);
  const h = await haptics();
  try {
    await h?.Haptics.impact({ style: h.ImpactStyle.Light });
  } catch { /* ignore */ }
}

/** A meal logged, a day copied — something with weight to it. */
export async function tapMedium() {
  if (!native()) return webBuzz(20);
  const h = await haptics();
  try {
    await h?.Haptics.impact({ style: h.ImpactStyle.Medium });
  } catch { /* ignore */ }
}

/** A personal record. Worth feeling. */
export async function celebrate() {
  if (!native()) return webBuzz([0, 40, 60, 40, 60, 90]);
  const h = await haptics();
  try {
    await h?.Haptics.notification({ type: h.NotificationType.Success });
  } catch { /* ignore */ }
}

/** Rest is over. */
export async function alarm() {
  if (!native()) return webBuzz([0, 120, 80, 120]);
  const h = await haptics();
  try {
    await h?.Haptics.notification({ type: h.NotificationType.Warning });
  } catch { /* ignore */ }
}

/** Something was removed. */
export async function warn() {
  if (!native()) return webBuzz(30);
  const h = await haptics();
  try {
    await h?.Haptics.impact({ style: h.ImpactStyle.Heavy });
  } catch { /* ignore */ }
}
