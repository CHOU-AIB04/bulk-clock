import { describe, it, expect } from "vitest";
import { epley, parseRepRange, loadStep, tonnage, bestSet, muscleOf, volumeByMuscle } from "../src/lib/lifting.js";

const set = (w, r, type = "work", done = true) => ({ w, r, rpe: null, type, done });

describe("estimated 1RM", () => {
  it("returns the weight itself for a single", () => {
    expect(epley(100, 1)).toBe(100);
  });

  it("adds roughly 3.3% per rep", () => {
    expect(epley(100, 5)).toBeCloseTo(116.67, 2);
    expect(epley(100, 10)).toBeCloseTo(133.33, 2);
  });

  it("is zero for a set that never happened", () => {
    expect(epley(0, 5)).toBe(0);
    expect(epley(100, 0)).toBe(0);
  });
});

describe("best set", () => {
  it("picks the highest estimate, not the heaviest weight", () => {
    const best = bestSet([set(100, 1), set(90, 6)]);
    expect(best.w).toBe(90);            // 90 × 6 ≈ 108 beats a 100 kg single
  });

  it("ignores warm-ups", () => {
    expect(bestSet([set(200, 5, "warmup"), set(80, 5)]).w).toBe(80);
  });

  it("ignores rep counts too high for the formula to hold", () => {
    expect(bestSet([set(40, 30), set(80, 5)]).w).toBe(80);
  });

  it("returns null when there is nothing usable", () => {
    expect(bestSet([])).toBeNull();
    expect(bestSet([set(null, null)])).toBeNull();
  });
});

describe("rep ranges", () => {
  it("reads both dash characters", () => {
    expect(parseRepRange("8–10")).toEqual({ min: 8, max: 10 });
    expect(parseRepRange("10-12")).toEqual({ min: 10, max: 12 });
  });

  it("treats a single number as a fixed target", () => {
    expect(parseRepRange("5")).toEqual({ min: 5, max: 5 });
  });

  it("returns null for timed work, which has no reps to progress", () => {
    expect(parseRepRange("45 s")).toBeNull();
    expect(parseRepRange("60 sec")).toBeNull();
  });

  it("copes with a trailing qualifier", () => {
    expect(parseRepRange("8–10 ea")).toEqual({ min: 8, max: 10 });
  });
});

describe("load steps", () => {
  it("jumps further on lower body than upper", () => {
    expect(loadStep("Back squat")).toBe(5);
    expect(loadStep("Barbell bench press")).toBe(2.5);
  });

  it("treats deadlifts as a lower-body jump", () => {
    expect(loadStep("Conventional deadlift")).toBe(5);
  });
});

describe("volume", () => {
  it("sums weight times reps, excluding warm-ups", () => {
    expect(tonnage([set(100, 5), set(60, 10, "warmup")])).toBe(500);
  });

  it("counts only completed working sets per muscle", () => {
    const lifts = {
      "2026-01-01": {
        ex: {
          "Back squat": { sets: [set(100, 5), set(100, 5), set(60, 5, "warmup"), set(100, 5, "work", false)] },
          "Barbell bench press": { sets: [set(80, 5)] }
        }
      }
    };
    const v = volumeByMuscle(lifts, ["2026-01-01"]);
    expect(v.Legs).toBe(2);
    expect(v.Chest).toBe(1);
  });

  it("falls back to reading the name when a movement is not in the library", () => {
    expect(muscleOf("Zercher squat")).toBe("Legs");
    expect(muscleOf("Something unrecognisable")).toBe("Other");
  });
});
