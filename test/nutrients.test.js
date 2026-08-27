import { describe, it, expect } from "vitest";
import { nutrientsForGrams, nutrientGoal, NUTRIENTS, NUTRIENT_META } from "../src/data/nutrients.js";
import { FOODS, macrosFor } from "../src/data/foods.js";

describe("nutrient scaling", () => {
  it("scales linearly from the per-100 g figures", () => {
    const half = nutrientsForGrams("banana", 50);
    expect(half.fiber).toBeCloseTo(NUTRIENTS.banana.fiber / 2, 5);
    expect(half.potassium).toBeCloseTo(NUTRIENTS.banana.potassium / 2, 5);
  });

  it("returns null for a food with no data rather than zero", () => {
    expect(nutrientsForGrams("definitely_not_a_food", 100)).toBeNull();
  });

  it("keeps unknown fields as null, not zero", () => {
    const row = nutrientsForGrams("chicken_mince", 100);
    expect(row.vitD).toBeNull();
    expect(row.fiber).toBe(0);          // genuinely zero, and stored as such
  });
});

describe("reference intakes", () => {
  it("differs by sex where the reference does", () => {
    expect(nutrientGoal("iron", "female")).toBeGreaterThan(nutrientGoal("iron", "male"));
    expect(nutrientGoal("calcium", "female")).toBe(nutrientGoal("calcium", "male"));
  });

  it("marks sodium and saturated fat as ceilings, not targets", () => {
    const limits = NUTRIENT_META.filter(n => n.kind === "limit").map(n => n.key);
    expect(limits).toContain("sodium");
    expect(limits).toContain("satfat");
    expect(limits).not.toContain("iron");
  });
});

describe("the food database", () => {
  it("has no malformed rows", () => {
    for (const f of FOODS) {
      expect(f.id).toBeTruthy();
      expect(f.name).toBeTruthy();
      expect(Number.isFinite(f.kcal)).toBe(true);
      expect(Number.isFinite(f.p)).toBe(true);
      expect(f.units[0].label).toBe("g");
    }
  });

  it("has no duplicate ids", () => {
    const ids = FOODS.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has macros that roughly reconcile with the stated calories", () => {
    // 4/4/9 never lands exactly — fibre, alcohol and rounding all interfere —
    // but a row 30% out is a typo, not a rounding artefact.
    const bad = FOODS.filter(f => {
      if (f.kcal < 40) return false;
      const derived = f.p * 4 + f.c * 4 + f.f * 9;
      return Math.abs(derived - f.kcal) / f.kcal > 0.3;
    });
    expect(bad.map(f => f.id)).toEqual([]);
  });

  it("scales portions off the per-100 g values", () => {
    const banana = FOODS.find(f => f.id === "banana");
    const m = macrosFor(banana, 200, "g");
    expect(m.kcal).toBeCloseTo(banana.kcal * 2, 5);
    expect(m.grams).toBe(200);
  });
});
