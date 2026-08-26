/**
 * Adaptive maintenance calories.
 *
 * Mifflin–St Jeor is a population average applied to one person: right within
 * about 10% for most, meaningfully wrong for plenty. Two or three weeks of your
 * own intake and weight measure the real number directly, and after that there
 * is no reason to keep trusting the formula.
 *
 * The arithmetic is energy balance, nothing cleverer:
 *
 *     maintenance = average intake − (weight change in kcal / days)
 *
 * A kilo of body-mass change is taken as 7 700 kcal. That constant is itself an
 * approximation — early weight change is largely water and glycogen — which is
 * why nothing here acts on fewer than fourteen days, and why the estimate is
 * always shown with how much data is behind it.
 */

import { dayTotals, weightSeries, addDays, todayKey, parseKey } from "./store.js";
import { balanceMacros } from "./targets.js";

export const KCAL_PER_KG = 7700;
export const MIN_DAYS = 14;
export const MIN_WEIGHINS = 6;

/** Least-squares slope of weight against day number, in kg per day. */
function trendSlope(points) {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  return den === 0 ? null : num / den;
}

/**
 * Estimate maintenance from the last `window` days.
 *
 * Days with nothing logged are excluded rather than counted as zero — a day you
 * forgot to log is missing data, not a fast, and averaging zeros in would make
 * the estimate absurdly low.
 */
export function estimateTDEE(state, window = 21) {
  const today = todayKey();
  const start = addDays(today, -(window - 1));

  const logged = [];
  for (let i = 0; i < window; i++) {
    const key = addDays(today, -i);
    if (key === today) continue;                     // today is still in progress
    const t = dayTotals(key);
    if (t.kcal > 0) logged.push({ key, kcal: t.kcal });
  }

  const weights = weightSeries().filter(w => w.key >= start);
  const dayNum = key => Math.round((parseKey(key) - parseKey(start)) / 86400000);
  const points = weights.map(w => ({ x: dayNum(w.key), y: w.v }));

  const spanDays = points.length >= 2 ? points[points.length - 1].x - points[0].x : 0;
  const enough = logged.length >= MIN_DAYS && points.length >= MIN_WEIGHINS && spanDays >= MIN_DAYS - 1;

  if (!enough) {
    return {
      ok: false,
      loggedDays: logged.length,
      weighIns: points.length,
      spanDays,
      needDays: MIN_DAYS,
      needWeighIns: MIN_WEIGHINS
    };
  }

  const avgIntake = logged.reduce((s, d) => s + d.kcal, 0) / logged.length;
  const slope = trendSlope(points);                  // kg/day
  const tdee = Math.round(avgIntake - slope * KCAL_PER_KG);

  // How much to trust it: more logged days and a longer weigh-in span both help.
  const coverage = Math.min(1, logged.length / window);
  const span = Math.min(1, spanDays / 21);
  const confidence = Math.round(coverage * span * 100);

  return {
    ok: true,
    tdee,
    avgIntake: Math.round(avgIntake),
    ratePerWeek: Math.round(slope * 7 * 100) / 100,
    loggedDays: logged.length,
    weighIns: points.length,
    spanDays,
    window,
    confidence,
    quality: confidence >= 70 ? "good" : confidence >= 45 ? "fair" : "thin"
  };
}

/** The surplus or deficit the chosen objective asks for, in kcal/day. */
export function objectiveOffset(objective, tdee) {
  if (objective === "build") return Math.min(500, Math.max(300, Math.round(tdee * 0.15)));
  if (objective === "lose") return -Math.min(750, Math.max(400, Math.round(tdee * 0.2)));
  return 0;
}

/**
 * What the target should become, given a measured maintenance. Returns null when
 * the change is too small to be worth interrupting the user for — moving a
 * target by 40 kcal is noise, and prompting for it teaches people to ignore
 * prompts.
 */
export function proposeTargets(state, estimate) {
  if (!estimate?.ok) return null;

  const { profile } = state;
  const offset = objectiveOffset(profile.objective, estimate.tdee);
  const kcal = Math.round((estimate.tdee + offset) / 10) * 10;
  const delta = kcal - profile.kcalTarget;

  if (Math.abs(delta) < 75) return null;

  const next = balanceMacros(
    { kcal: profile.kcalTarget, protein: profile.pTarget, carbs: profile.cTarget, fat: profile.fTarget },
    "kcal",
    kcal
  );

  return {
    kcal,
    delta,
    protein: next.protein,
    carbs: next.carbs,
    fat: next.fat,
    reason: buildReason(state, estimate, offset, delta)
  };
}

function buildReason(state, e, offset, delta) {
  const { profile } = state;
  const dir = e.ratePerWeek > 0.05 ? "gaining" : e.ratePerWeek < -0.05 ? "losing" : "holding";
  const rate = Math.abs(e.ratePerWeek).toFixed(2);

  const want = profile.objective === "build" ? "gain about 0.35 kg a week"
    : profile.objective === "lose" ? "lose about 0.5 kg a week"
      : "hold your weight";

  return `Over ${e.spanDays} days you averaged ${e.avgIntake} kcal and were ${dir}${
    dir === "holding" ? "" : ` ${rate} kg a week`
  }. That puts your real maintenance at about ${e.tdee} kcal — ${
    Math.abs(e.tdee - (profile.kcalTarget - objectiveOffset(profile.objective, e.tdee)))
  } kcal from what the formula assumed. To ${want}, the target moves ${delta > 0 ? "up" : "down"} by ${Math.abs(delta)}.`;
}
