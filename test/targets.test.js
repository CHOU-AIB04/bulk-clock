import { describe, it, expect } from "vitest";
import {
  computeTargets, balanceMacros, macroKcal, macrosReconcile,
  mealSchedule, weeksToGoal, bmr
} from "../src/lib/targets.js";

const base = {
  sex: "male", age: 22, height: 165, weight: 52, goalWeight: 62,
  objective: "build", archetype: "meso", activity: "sed", trainingDays: 4
};

describe("resting metabolism", () => {
  it("follows Mifflin–St Jeor for men", () => {
    // 10(52) + 6.25(165) - 5(22) + 5 = 520 + 1031.25 - 110 + 5
    expect(bmr(base)).toBeCloseTo(1446.25, 2);
  });

  it("is 166 kcal lower for women at the same size", () => {
    expect(bmr({ ...base, sex: "male" }) - bmr({ ...base, sex: "female" })).toBe(166);
  });
});

describe("targets", () => {
  it("puts a build above maintenance and a cut below it", () => {
    const build = computeTargets({ ...base, objective: "build" });
    const cut = computeTargets({ ...base, objective: "lose" });
    const hold = computeTargets({ ...base, objective: "maintain" });

    expect(build.kcal).toBeGreaterThan(build.tdee);
    expect(cut.kcal).toBeLessThan(cut.tdee);
    expect(hold.kcal).toBe(hold.tdee);
  });

  it("anchors protein to goal weight when building, current weight when cutting", () => {
    const build = computeTargets({ ...base, objective: "build" });
    const cut = computeTargets({ ...base, objective: "lose" });
    expect(build.protein).toBe(Math.round(62 * 2.0));
    expect(cut.protein).toBe(Math.round(52 * 2.2));
  });

  it("never lets fat fall below 0.8 g per kilo", () => {
    const t = computeTargets({ ...base, objective: "lose" });
    expect(t.fat).toBeGreaterThanOrEqual(Math.round(52 * 0.8));
  });

  it("macros add up to the calorie target within rounding", () => {
    for (const objective of ["build", "lose", "maintain"]) {
      const t = computeTargets({ ...base, objective });
      const sum = macroKcal({ protein: t.protein, carbs: t.carbs, fat: t.fat });
      expect(Math.abs(sum - t.kcal)).toBeLessThanOrEqual(12);
    }
  });
});

describe("macro rebalancing", () => {
  const start = { kcal: 2700, protein: 124, carbs: 383, fat: 75 };

  it("keeps the calorie total when protein changes", () => {
    const next = balanceMacros(start, "protein", 170);
    expect(next.protein).toBe(170);
    expect(next.kcal).toBe(2700);
    expect(macrosReconcile(next).ok).toBe(true);
  });

  it("uses fat as the balancer when carbs are what changed", () => {
    const next = balanceMacros(start, "carbs", 300);
    expect(next.carbs).toBe(300);
    expect(next.protein).toBe(start.protein);
    expect(next.fat).not.toBe(start.fat);
    expect(macrosReconcile(next).ok).toBe(true);
  });

  it("rebalances carbs when the calorie target moves", () => {
    const next = balanceMacros(start, "kcal", 3000);
    expect(next.kcal).toBe(3000);
    expect(next.protein).toBe(start.protein);
    expect(next.fat).toBe(start.fat);
    expect(macrosReconcile(next).ok).toBe(true);
  });

  it("never produces a negative macro", () => {
    const next = balanceMacros(start, "protein", 900);
    expect(next.carbs).toBeGreaterThanOrEqual(0);
    expect(next.fat).toBeGreaterThanOrEqual(0);
  });

  it("raises calories rather than silently undoing an edit that cannot fit", () => {
    const next = balanceMacros(start, "protein", 900);
    expect(next.protein).toBe(900);
    expect(next.kcal).toBeGreaterThan(start.kcal);
  });
});

describe("meal schedule", () => {
  it("produces exactly the number of meals asked for", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(mealSchedule("08:00", n)).toHaveLength(n);
    }
  });

  it("never runs past midnight, even at eight meals", () => {
    const slots = mealSchedule("08:00", 8);
    const mins = slots.map(s => {
      const [h, m] = s.time.split(":").map(Number);
      return h * 60 + m;
    });
    for (let i = 1; i < mins.length; i++) expect(mins[i]).toBeGreaterThan(mins[i - 1]);
  });

  it("starts at the wake time", () => {
    expect(mealSchedule("06:45", 4)[0].time).toBe("06:45");
  });
});

describe("time to goal", () => {
  it("is null when the goal contradicts the objective", () => {
    expect(weeksToGoal({ ...base, objective: "build", weight: 62, goalWeight: 52 })).toBeNull();
  });

  it("scales with the distance to the goal", () => {
    const near = weeksToGoal({ ...base, goalWeight: 55 });
    const far = weeksToGoal({ ...base, goalWeight: 70 });
    expect(far).toBeGreaterThan(near);
  });
});
