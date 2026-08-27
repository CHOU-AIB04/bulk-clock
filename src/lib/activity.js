/**
 * Outdoor activities: runs, rides, walks.
 *
 * All of this is pure arithmetic over a list of GPS fixes, kept away from React
 * and away from the store so it can be reasoned about and tested on its own.
 *
 * The one thing worth understanding before reading further: **consumer GPS
 * lies**. A phone reports positions that jump five metres sideways while you
 * stand still, altitude that wanders by ten metres under a cloud, and the
 * occasional fix from entirely the wrong side of the street. Every function here
 * is written around that. Points are filtered before they count, altitude is
 * smoothed before elevation is summed, and pace is computed over a window rather
 * than between two fixes.
 */

export const ACTIVITY_TYPES = [
  {
    id: "run", label: "Run", icon: "run", gps: true,
    maxSpeedKmh: 30, met: s => (s <= 0 ? 3.5 : Math.max(6, Math.min(20, 0.98 * s + 1.2))),
    blurb: "Distance, pace per kilometre and elevation"
  },
  {
    id: "walk", label: "Walk", icon: "walk", gps: true,
    maxSpeedKmh: 12, met: s => (s <= 0 ? 2.0 : Math.max(2.5, Math.min(7, 0.6 * s + 1.0))),
    blurb: "The easiest way to add activity without touching recovery"
  },
  {
    id: "hike", label: "Hike", icon: "hike", gps: true,
    maxSpeedKmh: 12, met: s => (s <= 0 ? 3.0 : Math.max(4, Math.min(9, 0.7 * s + 2.2))),
    blurb: "Like a walk, but elevation is the point"
  },
  {
    id: "cycle", label: "Cycle", icon: "bike", gps: true,
    maxSpeedKmh: 70, met: s => (s <= 0 ? 3.5 : Math.max(4, Math.min(16, 0.42 * s + 0.6))),
    blurb: "Distance, average speed and elevation"
  },
  {
    id: "indoor_bike", label: "Indoor bike", icon: "bike", gps: false,
    maxSpeedKmh: 0, met: () => 7.0,
    blurb: "No GPS — time and effort only"
  },
  {
    id: "row", label: "Rowing", icon: "row", gps: false,
    maxSpeedKmh: 0, met: () => 7.0,
    blurb: "No GPS — time and effort only"
  },
  {
    id: "other", label: "Other", icon: "other", gps: false,
    maxSpeedKmh: 0, met: () => 5.0,
    blurb: "Football, swimming, anything else"
  }
];

export const typeOf = id => ACTIVITY_TYPES.find(t => t.id === id) || ACTIVITY_TYPES[0];

/* ── geometry ────────────────────────────────────────────── */

const R_EARTH = 6371008.8;   // metres, mean radius
const rad = d => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* ── filtering the lies out ──────────────────────────────── */

/** Fixes worse than this are noise, not position. */
export const MAX_ACCURACY_M = 35;

/** Below this, movement is indistinguishable from the fix wandering. */
export const MIN_STEP_M = 4;

/**
 * Should this fix be believed, given the one before it?
 *
 * Three tests: is the fix itself accurate enough, did we actually move further
 * than the error bars, and does the implied speed make sense for this activity.
 * A fix that claims 90 km/h on a run is a tower handoff, not a sprint.
 */
export function acceptPoint(prev, next, maxSpeedKmh) {
  if (!next || !Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return false;
  if (next.acc != null && next.acc > MAX_ACCURACY_M) return false;
  if (!prev) return true;

  const metres = haversine(prev, next);
  const seconds = Math.max(0.001, (next.t - prev.t) / 1000);

  if (metres < MIN_STEP_M) return false;                       // standing still
  if (maxSpeedKmh > 0 && (metres / seconds) * 3.6 > maxSpeedKmh) return false;
  return true;
}

/* ── the numbers people care about ───────────────────────── */

/** Total distance in metres along a track. */
export function trackDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
  return total;
}

/**
 * Elevation gain, in metres.
 *
 * GPS altitude is the least reliable number a phone produces — it drifts by ten
 * metres or more without you moving. So the series is smoothed with a moving
 * average first, and only rises past a threshold are counted. The result still
 * is not survey-grade, but it stops a flat run reporting 200 m of climb.
 */
export function elevationGain(points, threshold = 2.5, window = 5) {
  const alts = points.map(p => p.alt).filter(a => a != null && Number.isFinite(a));
  if (alts.length < window + 2) return 0;

  const smoothed = [];
  for (let i = 0; i < alts.length; i++) {
    const from = Math.max(0, i - Math.floor(window / 2));
    const to = Math.min(alts.length, from + window);
    const slice = alts.slice(from, to);
    smoothed.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }

  let gain = 0;
  let anchor = smoothed[0];
  for (const a of smoothed) {
    if (a - anchor >= threshold) {
      gain += a - anchor;
      anchor = a;
    } else if (a < anchor) {
      anchor = a;
    }
  }
  return gain;
}

/** Seconds per kilometre. Returns null when there is nothing to divide by. */
export function paceSecPerKm(metres, movingMs) {
  if (!(metres > 0) || !(movingMs > 0)) return null;
  return movingMs / 1000 / (metres / 1000);
}

export function formatPace(secPerKm) {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = n => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDistance(metres, imperial = false) {
  if (imperial) {
    const miles = metres / 1609.344;
    return miles < 0.1 ? `${Math.round(metres * 3.28084)} ft` : `${miles.toFixed(2)} mi`;
  }
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(2)} km`;
}

/**
 * Per-kilometre splits, interpolated so each one is a true kilometre rather than
 * "whatever distance fell between two GPS fixes".
 */
export function splits(points, unitM = 1000) {
  if (points.length < 2) return [];

  const out = [];
  let covered = 0;
  let markAt = unitM;
  let markTime = points[0].t;

  for (let i = 1; i < points.length; i++) {
    const step = haversine(points[i - 1], points[i]);
    if (step <= 0) continue;

    let start = covered;
    covered += step;

    while (covered >= markAt) {
      // Where in this segment the kilometre actually fell.
      const fraction = (markAt - start) / step;
      const at = points[i - 1].t + (points[i].t - points[i - 1].t) * fraction;
      out.push({
        index: out.length + 1,
        distanceM: unitM,
        durationMs: at - markTime,
        paceSecPerKm: (at - markTime) / 1000 / (unitM / 1000)
      });
      markTime = at;
      markAt += unitM;
      start = markAt - unitM;
    }
  }

  const remainder = covered - (markAt - unitM);
  if (remainder > unitM * 0.15) {
    const last = points[points.length - 1].t;

    // Summing hundreds of haversine hops lands a "3 km" run on 2 999.97 m, which
    // would otherwise report two kilometres and a 999-metre fragment. Anything
    // within a percent of the full distance is that distance.
    const isFull = remainder >= unitM * 0.99;

    out.push({
      index: out.length + 1,
      distanceM: remainder,
      durationMs: last - markTime,
      paceSecPerKm: (last - markTime) / 1000 / (remainder / 1000),
      ...(isFull ? {} : { partial: true })
    });
  }

  return out;
}

/**
 * Energy cost, from METs and bodyweight.
 *
 * kcal/min = MET × 3.5 × kg / 200. This is a population equation and it does not
 * know your running economy, the wind, or the hill — treat it as the right order
 * of magnitude rather than a measurement, which is why the UI labels it as an
 * estimate everywhere it appears.
 */
export function estimateCalories(typeId, weightKg, movingMs, distanceM) {
  const type = typeOf(typeId);
  const minutes = movingMs / 60000;
  if (minutes <= 0) return 0;

  const speedKmh = distanceM > 0 ? (distanceM / 1000) / (movingMs / 3600000) : 0;
  const met = type.met(speedKmh);
  return Math.round((met * 3.5 * weightKg / 200) * minutes);
}

/* ── drawing the route ───────────────────────────────────── */

/**
 * Project a track into an SVG viewBox.
 *
 * Web Mercator, so the shape matches every map anyone has ever seen, with the
 * longitude scale corrected by latitude — without that, a route in Morocco
 * comes out noticeably squashed.
 */
export function projectTrack(points, width, height, padding = 12) {
  if (!points.length) return { path: "", points: [], bounds: null };

  // Both axes must be in the SAME units or the projection stretches: Mercator y
  // is a function of latitude in radians, so x has to be longitude in radians
  // too. Using degrees for x and radians for y squashes every route into a
  // shape that is not the one you ran.
  const mercY = lat => Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2));

  const xs = points.map(p => rad(p.lng));
  const ys = points.map(p => mercY(p.lat));

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const spanX = Math.max(1e-9, maxX - minX);
  const spanY = Math.max(1e-9, maxY - minY);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  // One scale for both axes, so the route keeps its shape instead of stretching
  // to fill the box.
  const scale = Math.min(innerW / spanX, innerH / spanY);

  const offsetX = padding + (innerW - spanX * scale) / 2;
  const offsetY = padding + (innerH - spanY * scale) / 2;

  const projected = points.map(p => ({
    x: offsetX + (rad(p.lng) - minX) * scale,
    // SVG y grows downward; Mercator y grows northward.
    y: offsetY + (maxY - mercY(p.lat)) * scale
  }));

  const path = projected
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return {
    path,
    points: projected,
    bounds: {
      minLat: Math.min(...points.map(p => p.lat)),
      maxLat: Math.max(...points.map(p => p.lat)),
      minLng: Math.min(...points.map(p => p.lng)),
      maxLng: Math.max(...points.map(p => p.lng))
    }
  };
}

/** Thin a long track for drawing. A 20 km run is thousands of fixes. */
export function simplify(points, maxPoints = 600) {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[Math.floor(i)]);
  // Always keep the finish, or the route appears to stop early.
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}
