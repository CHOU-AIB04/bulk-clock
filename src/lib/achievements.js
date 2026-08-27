/**
 * Milestones the app notices for you.
 *
 * Distinct from challenges, which you set yourself. These are all derived from
 * data you already have, so nothing is stored and nothing can drift out of sync
 * — an achievement is simply a question asked of the log.
 *
 * Deliberately no loss mechanics: nothing here can be taken away, expire, or
 * break. Streak-anxiety is a real thing and it has no place near eating.
 */

import {
  dayTotals, todayKey, addDays, dayConsistency, consistencyStreak,
  weightSeries, sessionDoneSets, measurementSeries
} from "./store.js";
import { bestSet, tonnage } from "./lifting.js";

const r0 = n => Math.round(n);

/** Count of days, anywhere in the log, that satisfy a predicate. */
function countDays(state, fn) {
  return Object.keys(state.log).filter(fn).length;
}

export function computeAchievements(state) {
  const today = todayKey();

  const daysLogged = countDays(state, k => (state.log[k]?.entries?.length || 0) > 0);
  const daysKept = Object.keys({ ...state.log, ...state.checkins })
    .filter(k => dayConsistency(k).pct >= 0.8).length;
  const streak = consistencyStreak();

  const sessions = Object.keys(state.lifts).filter(k => sessionDoneSets(k) > 0).length;
  const totalTonnage = Object.values(state.lifts).reduce(
    (n, day) => n + Object.values(day.ex || {}).reduce((m, rec) => m + tonnage(rec.sets), 0),
    0
  );

  const weights = weightSeries();
  const gained = weights.length >= 2
    ? Math.round((weights[weights.length - 1].v - state.profile.startWeight) * 10) / 10
    : 0;

  // The heaviest single set ever logged, and the best estimated 1RM on the big three.
  let heaviest = 0;
  const bigThree = {};
  for (const day of Object.values(state.lifts)) {
    for (const [name, rec] of Object.entries(day.ex || {})) {
      for (const s of rec.sets || []) {
        if (s.type !== "warmup" && s.w > heaviest) heaviest = s.w;
      }
      const b = bestSet(rec.sets);
      if (!b) continue;
      const key = /squat/i.test(name) ? "squat" : /bench/i.test(name) ? "bench" : /deadlift/i.test(name) ? "deadlift" : null;
      if (key) bigThree[key] = Math.max(bigThree[key] || 0, b.e1rm);
    }
  }

  const protein100 = countDays(state, k => dayTotals(k).p >= 100);
  const mealsBuilt = state.meals.length;
  const foodsAdded = state.customFoods.length;
  const photoDays = Object.keys(state.photos || {}).length;
  const measured = measurementSeries("waist").length;

  const TIERS = [
    tier("log", "Days logged", daysLogged, [1, 7, 30, 100, 365], n =>
      n === 1 ? "First day logged" : `${n} days logged`),
    tier("kept", "Days kept", daysKept, [1, 10, 50, 150, 365], n => `${n} days kept`),
    tier("streak", "Longest run", streak, [3, 7, 21, 60, 100], n => `${n} days in a row`),
    tier("sessions", "Sessions", sessions, [1, 10, 50, 150, 500], n =>
      n === 1 ? "First session logged" : `${n} sessions`),
    tier("tonnage", "Weight moved", Math.round(totalTonnage), [10000, 100000, 500000, 1000000, 5000000], n =>
      `${(n / 1000).toLocaleString()} tonnes moved`),
    tier("heaviest", "Heaviest set", heaviest, [40, 60, 80, 100, 140], n => `${n} kg on a single set`),
    tier("squat", "Squat 1RM", Math.round(bigThree.squat || 0), [60, 80, 100, 140, 180], n => `${n} kg estimated squat`),
    tier("bench", "Bench 1RM", Math.round(bigThree.bench || 0), [40, 60, 80, 100, 140], n => `${n} kg estimated bench`),
    tier("deadlift", "Deadlift 1RM", Math.round(bigThree.deadlift || 0), [80, 100, 140, 180, 220], n => `${n} kg estimated deadlift`),
    tier("protein", "Protein days", protein100, [1, 10, 50, 150, 365], n => `${n} days over 100 g protein`),
    tier("gain", "Weight gained", Math.max(0, gained), [1, 3, 5, 10, 15], n => `${n} kg gained`),
    tier("meals", "Recipes built", mealsBuilt, [1, 5, 15, 30, 60], n => `${n} recipes built`),
    tier("foods", "Foods added", foodsAdded, [1, 5, 20, 50, 100], n => `${n} of your own foods`),
    tier("photos", "Progress photos", photoDays, [1, 4, 12, 26, 52], n => `${n} photo day${n === 1 ? "" : "s"}`),
    tier("waist", "Waist measured", measured, [1, 4, 12, 26, 52], n => `${n} waist measurement${n === 1 ? "" : "s"}`)
  ].filter(Boolean);

  const earned = TIERS.filter(t => t.level > 0);
  const next = TIERS.filter(t => t.next != null).sort((a, b) => b.progress - a.progress);

  return { earned, next, all: TIERS };
}

/** One achievement family: five thresholds, the highest reached, and what's next. */
function tier(id, family, value, thresholds, label) {
  let level = 0;
  for (const t of thresholds) if (value >= t) level++;
  const nextThreshold = thresholds[level] ?? null;
  return {
    id,
    family,
    value,
    level,
    max: thresholds.length,
    title: level > 0 ? label(thresholds[level - 1]) : label(thresholds[0]),
    nextTitle: nextThreshold != null ? label(nextThreshold) : null,
    next: nextThreshold,
    remaining: nextThreshold != null ? Math.max(0, nextThreshold - value) : null,
    progress: nextThreshold != null ? Math.min(1, value / nextThreshold) : 1
  };
}
