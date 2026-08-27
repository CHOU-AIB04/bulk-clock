import { describe, it, expect, beforeEach } from "vitest";
import * as S from "../src/lib/store.js";

const KEY = "2026-03-16";           // a Monday

beforeEach(() => {
  S.resetEverything();
  S.setProfile({ onboarded: true, kcalTarget: 2700, pTarget: 130, cTarget: 380, fTarget: 75 });
});

describe("dates", () => {
  it("round-trips a key through a Date", () => {
    expect(S.dkey(S.parseKey(KEY))).toBe(KEY);
  });

  it("counts Monday as weekday 1 and Sunday as 7", () => {
    expect(S.weekdayOf("2026-03-16")).toBe(1);
    expect(S.weekdayOf("2026-03-22")).toBe(7);
  });

  it("adds days across a month boundary", () => {
    expect(S.addDays("2026-03-30", 3)).toBe("2026-04-02");
    expect(S.addDays("2026-03-02", -3)).toBe("2026-02-27");
  });

  it("puts a 01:00 snack on the previous day", () => {
    const lateNight = new Date(2026, 2, 17, 1, 30);
    expect(S.dkey(S.logicalDate(lateNight))).toBe("2026-03-16");
  });

  it("keeps a 05:00 breakfast on its own day", () => {
    const earlyMorning = new Date(2026, 2, 17, 5, 0);
    expect(S.dkey(S.logicalDate(earlyMorning))).toBe("2026-03-17");
  });

  it("starts the week on Monday", () => {
    expect(S.weekStart("2026-03-19")).toBe("2026-03-16");
    expect(S.weekStart("2026-03-22")).toBe("2026-03-16");
  });
});

describe("logging", () => {
  it("snapshots macros so later database edits cannot rewrite history", () => {
    S.logQuick(KEY, "m1", "Tagine", 600, 40, 50, 25);
    const totals = S.dayTotals(KEY);
    expect(totals.kcal).toBe(600);
    expect(totals.p).toBe(40);
  });

  it("scales an edited entry proportionally", () => {
    S.logQuick(KEY, "m1", "Tagine", 600, 40, 50, 25);
    const entry = S.dayEntries(KEY)[0];
    S.updateEntry(KEY, entry.id, 2, "entry");
    expect(S.dayTotals(KEY).kcal).toBe(1200);
  });

  it("moves an entry between meals without changing the day's total", () => {
    S.logQuick(KEY, "m1", "Tagine", 600, 40, 50, 25);
    const entry = S.dayEntries(KEY)[0];
    S.moveEntry(KEY, entry.id, "m2");
    expect(S.dayEntries(KEY)[0].slot).toBe("m2");
    expect(S.dayTotals(KEY).kcal).toBe(600);
  });

  it("copies a day without linking the two", () => {
    S.logQuick(KEY, "m1", "Tagine", 600, 40, 50, 25);
    S.copyDay(KEY, "2026-03-17");
    const copied = S.dayEntries("2026-03-17")[0];
    S.removeEntry(KEY, S.dayEntries(KEY)[0].id);
    expect(S.dayEntries("2026-03-17")).toHaveLength(1);
    expect(copied.id).not.toBe(undefined);
  });
});

describe("recipes", () => {
  const recipe = {
    id: "r1",
    name: "Rice plate",
    servings: 4,
    items: [{ foodId: "rice_white_raw", amount: 400, unit: "g" }]
  };

  it("divides a recipe by the servings it makes", () => {
    S.saveMeal(recipe);
    const whole = S.mealMacros(recipe);
    const per = S.mealServingMacros(recipe);
    expect(per.kcal).toBeCloseTo(whole.kcal / 4, 5);
  });

  it("logs portions of a serving, not copies of the recipe", () => {
    S.saveMeal(recipe);
    S.logMeal(KEY, "m1", recipe, 2);
    const per = S.mealServingMacros(recipe);
    expect(S.dayTotals(KEY).kcal).toBeCloseTo(per.kcal * 2, 5);
  });

  it("treats a missing servings value as one", () => {
    expect(S.mealServings({ items: [] })).toBe(1);
    expect(S.mealServings({ items: [], servings: 0 })).toBe(1);
  });
});

describe("the meal schedule", () => {
  it("moves logged food rather than dropping it when a slot is deleted", () => {
    const slots = S.getState().profile.slots;
    S.logQuick(KEY, slots[0].id, "Eggs", 300, 20, 5, 20);
    S.removeSlot(slots[0].id, slots[1].id);

    expect(S.dayTotals(KEY).kcal).toBe(300);
    expect(S.dayEntries(KEY)[0].slot).toBe(slots[1].id);
    expect(S.orphanEntries(KEY)).toHaveLength(0);
  });

  it("refuses to delete the last remaining slot", () => {
    const ids = S.getState().profile.slots.map(s => s.id);
    for (const id of ids) S.removeSlot(id);
    expect(S.getState().profile.slots.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps slots in clock order after a retime", () => {
    const slots = S.getState().profile.slots;
    S.updateSlot(slots[0].id, { time: "23:00" });
    const times = S.getState().profile.slots.map(s => s.time);
    expect([...times].sort()).toEqual(times);
  });

  it("rebuilds the whole day at any number of meals", () => {
    S.applyMealPreset(7, "07:00");
    expect(S.getState().profile.slots).toHaveLength(7);
    S.applyMealPreset(2, "10:00");
    expect(S.getState().profile.slots).toHaveLength(2);
  });

  it("never orphans food when the schedule shrinks", () => {
    const slots = S.getState().profile.slots;
    S.logQuick(KEY, slots[slots.length - 1].id, "Dinner", 800, 50, 60, 30);
    S.applyMealPreset(2, "10:00");
    expect(S.orphanEntries(KEY)).toHaveLength(0);
    expect(S.dayTotals(KEY).kcal).toBe(800);
  });
});

describe("consistency", () => {
  it("counts a logged meal as eaten without asking twice", () => {
    const slots = S.getState().profile.slots;
    S.logQuick(KEY, slots[0].id, "Eggs", 300, 20, 5, 20);
    expect(S.dayConsistency(KEY).done).toBe(1);
  });

  it("lets an explicit 'no' override a logged meal", () => {
    const slots = S.getState().profile.slots;
    S.logQuick(KEY, slots[0].id, "Eggs", 300, 20, 5, 20);
    S.setMealCheck(KEY, slots[0].id, "no");
    expect(S.dayConsistency(KEY).done).toBe(0);
  });

  it("clears an answer when the same one is tapped twice", () => {
    const slots = S.getState().profile.slots;
    S.setMealCheck(KEY, slots[0].id, "yes");
    S.setMealCheck(KEY, slots[0].id, "yes");
    expect(S.checkinFor(KEY).meals[slots[0].id]).toBeNull();
  });
});

describe("planning", () => {
  it("keeps a plan out of the day's totals until it is logged", () => {
    S.saveMeal({ id: "r2", name: "Oats", servings: 1, items: [{ foodId: "oats_dry", amount: 100, unit: "g" }] });
    S.addToPlan(KEY, "m1", { kind: "meal", ref: "r2", amount: 1, unit: "serving" });

    expect(S.dayTotals(KEY).kcal).toBe(0);
    expect(S.planTotals(KEY).kcal).toBeGreaterThan(0);

    S.logPlanned(KEY);
    expect(S.dayTotals(KEY).kcal).toBeGreaterThan(0);
    expect(S.planTotals(KEY).kcal).toBe(0);
  });

  it("expands recipes into ingredients for the shopping list", () => {
    S.saveMeal({
      id: "r3", name: "Plate", servings: 2,
      items: [{ foodId: "rice_white_raw", amount: 200, unit: "g" }, { foodId: "chicken_breast", amount: 300, unit: "g" }]
    });
    S.addToPlan(KEY, "m1", { kind: "meal", ref: "r3", amount: 2, unit: "serving" });

    const list = S.shoppingList(KEY, 1);
    const names = list.categories.flatMap(c => c.items.map(i => i.foodId));
    expect(names).toContain("rice_white_raw");
    expect(names).toContain("chicken_breast");

    const rice = list.categories.flatMap(c => c.items).find(i => i.foodId === "rice_white_raw");
    expect(rice.grams).toBe(200);      // two of two servings = the whole recipe
  });
});

describe("day-type targets", () => {
  it("leaves every day identical when the option is off", () => {
    const a = S.targetsFor("2026-03-16");
    const b = S.targetsFor("2026-03-17");
    expect(a.kcal).toBe(b.kcal);
  });

  it("moves calories between days without changing the week", () => {
    S.setProgram({
      name: "Test",
      days: {
        1: { name: "A", time: "17:00", ex: [{ name: "Back squat", sets: 3, reps: "5" }] },
        3: { name: "B", time: "17:00", ex: [{ name: "Back squat", sets: 3, reps: "5" }] }
      }
    });
    S.setSetting({ dayTypeTargets: true, dayTypeSwing: 0.15 });

    const week = Array.from({ length: 7 }, (_, i) => S.targetsFor(S.addDays("2026-03-16", i)));
    const total = week.reduce((n, t) => n + t.kcal, 0);
    const flat = S.getState().profile.kcalTarget * 7;

    expect(Math.abs(total - flat)).toBeLessThanOrEqual(7);   // rounding only
    expect(week[0].dayType).toBe("training");
    expect(week[1].dayType).toBe("rest");
    expect(week[0].kcal).toBeGreaterThan(week[1].kcal);
  });
});

describe("periodisation", () => {
  it("deloads on the last week of each cycle", () => {
    S.setProfile({ programStart: "2026-03-16" });
    S.setProgram({ name: "T", block: { enabled: true, cycleWeeks: 5, maxAddedSets: 2 }, days: {
      1: { name: "A", time: "17:00", ex: [{ name: "Back squat", sets: 4, reps: "5" }] }
    } });

    const week1 = S.plannedSessionFor("2026-03-16");
    const week3 = S.plannedSessionFor("2026-03-30");
    const week5 = S.plannedSessionFor("2026-04-13");

    expect(week1.ex[0].sets).toBe(4);
    expect(week3.ex[0].sets).toBe(6);      // +2, the cap
    expect(week5.phase.deload).toBe(true);
    expect(week5.ex[0].sets).toBe(2);      // halved
  });
});
