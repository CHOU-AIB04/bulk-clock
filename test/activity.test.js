import { describe, it, expect } from "vitest";
import {
  haversine, acceptPoint, trackDistance, elevationGain, paceSecPerKm,
  formatPace, formatDuration, formatDistance, splits, estimateCalories,
  projectTrack, simplify, typeOf
} from "../src/lib/activity.js";

const p = (lat, lng, t = 0, alt = null, acc = 5) => ({ lat, lng, t, alt, acc });

describe("distance", () => {
  it("matches a known great-circle distance", () => {
    // Casablanca to Rabat is about 86 km.
    const km = haversine(p(33.5731, -7.5898), p(34.0209, -6.8416)) / 1000;
    expect(km).toBeGreaterThan(83);
    expect(km).toBeLessThan(89);
  });

  it("is zero for the same point", () => {
    expect(haversine(p(33.5, -7.5), p(33.5, -7.5))).toBe(0);
  });

  it("sums along a track", () => {
    const track = [p(33.5, -7.5), p(33.51, -7.5), p(33.52, -7.5)];
    const total = trackDistance(track);
    expect(total).toBeCloseTo(haversine(track[0], track[1]) * 2, 0);
  });
});

describe("filtering GPS noise", () => {
  it("accepts the first fix when it is accurate", () => {
    expect(acceptPoint(null, p(33.5, -7.5, 0, null, 8), 30)).toBe(true);
  });

  it("rejects a fix with hopeless accuracy", () => {
    expect(acceptPoint(null, p(33.5, -7.5, 0, null, 120), 30)).toBe(false);
  });

  it("rejects standing still", () => {
    const a = p(33.5, -7.5, 0);
    const b = p(33.500005, -7.5, 5000);   // about half a metre
    expect(acceptPoint(a, b, 30)).toBe(false);
  });

  it("rejects a jump no runner could make", () => {
    const a = p(33.5, -7.5, 0);
    const b = p(33.52, -7.5, 1000);       // 2.2 km in one second
    expect(acceptPoint(a, b, 30)).toBe(false);
  });

  it("accepts a plausible step", () => {
    const a = p(33.5, -7.5, 0);
    const b = p(33.5001, -7.5, 4000);     // ~11 m in 4 s, about 10 km/h
    expect(acceptPoint(a, b, 30)).toBe(true);
  });
});

describe("elevation", () => {
  it("ignores altitude noise on flat ground", () => {
    const track = Array.from({ length: 40 }, (_, i) =>
      p(33.5 + i * 0.0001, -7.5, i * 1000, 100 + Math.sin(i) * 1.2));
    expect(elevationGain(track)).toBeLessThan(6);
  });

  it("counts a real climb", () => {
    const track = Array.from({ length: 40 }, (_, i) =>
      p(33.5 + i * 0.0001, -7.5, i * 1000, 100 + i * 2));
    expect(elevationGain(track)).toBeGreaterThan(60);
  });

  it("returns zero without altitude data", () => {
    const track = Array.from({ length: 20 }, (_, i) => p(33.5 + i * 0.0001, -7.5, i * 1000));
    expect(elevationGain(track)).toBe(0);
  });
});

describe("pace and formatting", () => {
  it("computes seconds per kilometre", () => {
    expect(paceSecPerKm(5000, 25 * 60000)).toBe(300);
  });

  it("formats pace as minutes and seconds", () => {
    expect(formatPace(300)).toBe("5:00");
    expect(formatPace(272)).toBe("4:32");
    expect(formatPace(null)).toBe("—");
  });

  it("formats duration with hours only when there are hours", () => {
    expect(formatDuration(65000)).toBe("1:05");
    expect(formatDuration(3725000)).toBe("1:02:05");
  });

  it("switches from metres to kilometres", () => {
    expect(formatDistance(850)).toBe("850 m");
    expect(formatDistance(5432)).toBe("5.43 km");
    expect(formatDistance(5432, true)).toBe("3.38 mi");
  });
});

describe("splits", () => {
  /** A straight line north at a steady pace, one fix every 10 seconds. */
  function steadyTrack(metres, secondsPerKm) {
    const points = [];
    const stepM = 10;
    const stepS = (secondsPerKm / 1000) * stepM;
    for (let d = 0; d <= metres; d += stepM) {
      points.push(p(33.5 + d / 111320, -7.5, (d / stepM) * stepS * 1000));
    }
    return points;
  }

  it("produces one split per kilometre", () => {
    const s = splits(steadyTrack(3000, 300));
    expect(s.filter(x => !x.partial)).toHaveLength(3);
  });

  it("gets the pace of a steady run right", () => {
    const s = splits(steadyTrack(2000, 300));
    expect(s[0].paceSecPerKm).toBeGreaterThan(290);
    expect(s[0].paceSecPerKm).toBeLessThan(310);
  });

  it("flags a trailing part-kilometre instead of comparing it", () => {
    const s = splits(steadyTrack(2600, 300));
    const last = s[s.length - 1];
    expect(last.partial).toBe(true);
    expect(last.distanceM).toBeLessThan(1000);
  });

  it("returns nothing for a track that never moved", () => {
    expect(splits([p(33.5, -7.5, 0)])).toEqual([]);
  });
});

describe("calories", () => {
  it("scales with bodyweight", () => {
    const light = estimateCalories("run", 50, 30 * 60000, 5000);
    const heavy = estimateCalories("run", 100, 30 * 60000, 5000);
    expect(heavy).toBeGreaterThan(light * 1.8);
  });

  it("is zero for no time", () => {
    expect(estimateCalories("run", 70, 0, 0)).toBe(0);
  });

  it("puts a 10 km hour-long run in a believable range", () => {
    const kcal = estimateCalories("run", 70, 60 * 60000, 10000);
    expect(kcal).toBeGreaterThan(500);
    expect(kcal).toBeLessThan(1000);
  });

  it("costs less on a bike than on foot at the same speed", () => {
    const run = estimateCalories("run", 70, 60 * 60000, 15000);
    const ride = estimateCalories("cycle", 70, 60 * 60000, 15000);
    expect(ride).toBeLessThan(run);
  });
});

describe("drawing the route", () => {
  it("keeps the shape rather than stretching to the box", () => {
    const track = [p(33.500, -7.500), p(33.510, -7.500), p(33.510, -7.499)];
    const { points } = projectTrack(track, 300, 200);
    // The long leg is north-south, so it must be the taller of the two.
    const vertical = Math.abs(points[1].y - points[0].y);
    const horizontal = Math.abs(points[2].x - points[1].x);
    expect(vertical).toBeGreaterThan(horizontal);
  });

  it("stays inside the box", () => {
    const track = Array.from({ length: 50 }, (_, i) => p(33.5 + i * 0.001, -7.5 + i * 0.0005));
    const { points } = projectTrack(track, 300, 200);
    for (const pt of points) {
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(300);
      expect(pt.y).toBeGreaterThanOrEqual(0);
      expect(pt.y).toBeLessThanOrEqual(200);
    }
  });

  it("thins a long track but keeps the finish", () => {
    const track = Array.from({ length: 5000 }, (_, i) => p(33.5 + i * 0.00001, -7.5, i));
    const thin = simplify(track, 400);
    expect(thin.length).toBeLessThanOrEqual(401);
    expect(thin[thin.length - 1]).toBe(track[track.length - 1]);
  });
});

describe("activity types", () => {
  it("falls back to a real type for an unknown id", () => {
    expect(typeOf("nonsense").id).toBe("run");
  });

  it("marks the indoor ones as having no GPS", () => {
    expect(typeOf("indoor_bike").gps).toBe(false);
    expect(typeOf("run").gps).toBe(true);
  });
});
