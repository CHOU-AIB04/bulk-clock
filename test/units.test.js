import { describe, it, expect, beforeEach } from "vitest";
import { resetEverything, setSetting } from "../src/lib/store.js";
import {
  toDisplayWeight, fromDisplayWeight, formatHeight,
  toDisplayLength, fromDisplayLength, formatVolume, plateSet
} from "../src/lib/units.js";

beforeEach(() => resetEverything());

describe("metric", () => {
  it("passes stored values straight through", () => {
    expect(toDisplayWeight(72.5)).toBe(72.5);
    expect(fromDisplayWeight("72.5")).toBe(72.5);
    expect(toDisplayLength(81)).toBe(81);
  });
});

describe("imperial", () => {
  beforeEach(() => setSetting({ units: "imperial" }));

  it("converts kilograms to pounds", () => {
    expect(toDisplayWeight(100)).toBeCloseTo(220.5, 1);
  });

  it("round-trips without drift", () => {
    const kg = fromDisplayWeight(String(toDisplayWeight(82.4, 4)));
    expect(kg).toBeCloseTo(82.4, 3);
  });

  it("shows height in feet and inches", () => {
    expect(formatHeight(183)).toBe("6′ 0″");
    expect(formatHeight(165)).toBe("5′ 5″");
  });

  it("converts centimetres to inches", () => {
    expect(toDisplayLength(81)).toBeCloseTo(31.9, 1);
    expect(fromDisplayLength("32")).toBeCloseTo(81.28, 2);
  });

  it("uses fluid ounces for water", () => {
    expect(formatVolume(3000)).toBe("101 fl oz");
  });

  it("swaps the plate set rather than converting kilo plates", () => {
    expect(plateSet()[0]).toBe(45);
  });
});
