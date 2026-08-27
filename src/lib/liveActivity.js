/**
 * The lock-screen card, and the foreground service behind it.
 *
 * On Android this keeps the app's process alive so GPS fixes keep arriving with
 * the screen off — without it, a phone in a pocket records about four minutes of
 * an hour-long run. Everywhere else these are no-ops, and the tracker degrades to
 * "works while the app is open", which is the honest behaviour for a browser.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";

const Live = registerPlugin("LiveActivity");

const available = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LiveActivity");

export const isSupported = available;

export async function startLive(title = "Recording", text = "") {
  if (!available()) return false;
  try {
    await Live.start({ title, text });
    return true;
  } catch {
    return false;
  }
}

/**
 * Refresh the card. Called on a coarse cadence rather than every GPS fix —
 * Android coalesces rapid notification updates anyway, and redrawing five times
 * a second is battery spent on nothing.
 */
export async function updateLive({ title, text, paused = false }) {
  if (!available()) return false;
  try {
    await Live.update({ title, text, paused });
    return true;
  } catch {
    return false;
  }
}

export async function stopLive() {
  if (!available()) return false;
  try {
    await Live.stop();
    return true;
  } catch {
    return false;
  }
}
