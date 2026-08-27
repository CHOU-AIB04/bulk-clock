/**
 * Getting position out of the phone.
 *
 * Uses the browser Geolocation API rather than a Capacitor plugin, because
 * inside a Capacitor WebView it is the same GPS either way and this needs no
 * extra dependency. Capacitor's bridge handles the Android runtime permission
 * prompt when the WebView asks for a fix.
 *
 * `watchPosition` only keeps delivering while the app process is alive and not
 * frozen, which is exactly what the foreground service in LiveActivity.java is
 * for — start that first and the fixes keep arriving with the screen off.
 */

export const GEO_OPTIONS = {
  enableHighAccuracy: true,
  // Never hand back a cached fix: a stale position is worse than no position
  // when the whole point is to measure movement.
  maximumAge: 0,
  timeout: 20000
};

export function isSupported() {
  return typeof navigator !== "undefined" && !!navigator.geolocation;
}

/** One fix, mostly to trigger the permission prompt before a run starts. */
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!isSupported()) {
      reject(new Error("This device has no location services."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(toPoint(pos)),
      err => reject(describe(err)),
      GEO_OPTIONS
    );
  });
}

export function toPoint(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    alt: pos.coords.altitude,
    acc: pos.coords.accuracy,
    speed: pos.coords.speed,
    t: pos.timestamp || Date.now()
  };
}

/** Turn a GeolocationPositionError into something a person can act on. */
export function describe(err) {
  const code = err?.code;
  if (code === 1) {
    return new Error("Location permission was refused. Allow it in Android settings, then start again.");
  }
  if (code === 2) {
    return new Error("No position available. GPS needs a view of the sky — this rarely works indoors.");
  }
  if (code === 3) {
    return new Error("Timed out waiting for a fix. Step outside and give it a moment.");
  }
  return new Error(err?.message || "Location is unavailable.");
}

/**
 * Watch position until stopped. Returns the stop function.
 *
 * Errors are reported but never stop the watch: losing signal under a bridge is
 * normal and the fixes come back on their own.
 */
export function watch(onPoint, onError) {
  if (!isSupported()) {
    onError?.(new Error("This device has no location services."));
    return () => {};
  }

  const id = navigator.geolocation.watchPosition(
    pos => onPoint(toPoint(pos)),
    err => onError?.(describe(err)),
    GEO_OPTIONS
  );

  return () => {
    try {
      navigator.geolocation.clearWatch(id);
    } catch {
      /* already gone */
    }
  };
}

/** How much to trust the current fix, for the signal dot. */
export function signalOf(accuracyM) {
  if (accuracyM == null) return "none";
  if (accuracyM <= 12) return "good";
  if (accuracyM <= 35) return "weak";
  return "none";
}
