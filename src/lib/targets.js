/**
 * Calorie and macro targets from biometrics.
 *
 * Every number here is an ESTIMATE. Mifflin–St Jeor predicts resting metabolism
 * within roughly ±10% for most people, and activity multipliers are cruder still.
 * The app treats these as a starting point and lets two weeks of real weight data
 * correct them — see the verdict logic in insights.js.
 */

export const OBJECTIVES = [
  {
    id: "build",
    label: "Build muscle",
    caps: "BUILD MUSCLE",
    desc: "Eat above maintenance and train to add size. Expect roughly 0.3–0.4 kg a week.",
    pace: "+0.35 kg / week"
  },
  {
    id: "lose",
    label: "Lose fat",
    caps: "LOSE FAT",
    desc: "Eat below maintenance while keeping protein high to protect muscle.",
    pace: "−0.5 kg / week"
  },
  {
    id: "maintain",
    label: "Maintain & recomp",
    caps: "MAINTAIN",
    desc: "Hold your weight, train hard, and let body composition shift slowly.",
    pace: "hold weight"
  }
];

export const ARCHETYPES = [
  { id: "ecto", label: "Ectomorph", desc: "Lean and long, with difficulty building muscle.", nudge: 60 },
  { id: "meso", label: "Mesomorph", desc: "Muscular and well-built, with high metabolism.", nudge: 0 },
  { id: "endo", label: "Endomorph", desc: "Stocky and strong, with slower metabolism.", nudge: -60 }
];

export const ACTIVITIES = [
  { id: "sed", label: "Mostly sitting", desc: "Desk work, little walking outside training.", mult: 1.25 },
  { id: "light", label: "Lightly active", desc: "On your feet part of the day, some walking.", mult: 1.4 },
  { id: "mod", label: "Active", desc: "Moving most of the day, or a physical job.", mult: 1.55 },
  { id: "high", label: "Very active", desc: "Manual labour, or training twice a day.", mult: 1.7 }
];

/** Mifflin–St Jeor resting metabolic rate, kcal/day. */
export function bmr({ weight, height, age, sex }) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return sex === "female" ? base - 161 : base + 5;
}

/**
 * Full target set. Training days add on top of the baseline activity multiplier,
 * because four hard sessions genuinely cost more than a sedentary week.
 */
export function computeTargets(p) {
  const rmr = bmr(p);
  const act = ACTIVITIES.find(a => a.id === p.activity) || ACTIVITIES[0];
  // A hard session costs roughly 300–400 kcal, which is about 4% of daily burn for
  // someone this size — 2.5% per day undershot the standard activity tables badly.
  const trainingBump = 1 + Math.min(6, Math.max(0, p.trainingDays || 0)) * 0.04;
  const tdee = Math.round(rmr * act.mult * trainingBump);

  const arch = ARCHETYPES.find(a => a.id === p.archetype);
  const nudge = p.objective === "build" ? (arch?.nudge || 0) : 0;

  let kcal, rate;
  if (p.objective === "build") {
    kcal = Math.round(tdee + Math.min(500, Math.max(300, tdee * 0.15)) + nudge);
    rate = 0.35;
  } else if (p.objective === "lose") {
    kcal = Math.round(tdee - Math.min(750, Math.max(400, tdee * 0.2)));
    rate = -0.5;
  } else {
    kcal = tdee;
    rate = 0;
  }

  // Protein anchors to goal weight when bulking (you're feeding the body you're building)
  // and to current weight otherwise.
  const refWeight = p.objective === "build" ? Math.max(p.weight, p.goalWeight || p.weight) : p.weight;
  const gPerKg = p.objective === "lose" ? 2.2 : p.objective === "build" ? 2.0 : 1.8;
  const protein = Math.round(refWeight * gPerKg);

  // Fat: a quarter of calories, floored at 0.8 g/kg so hormones don't suffer on a cut.
  const fat = Math.max(Math.round((kcal * 0.25) / 9), Math.round(p.weight * 0.8));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return { rmr: Math.round(rmr), tdee, kcal, protein, carbs, fat, rate };
}

/** Weeks to reach the goal weight at the objective's expected rate. */
export function weeksToGoal(p) {
  const { rate } = computeTargets(p);
  if (!rate || !p.goalWeight) return null;
  const diff = p.goalWeight - p.weight;
  if (Math.sign(diff) !== Math.sign(rate)) return null;
  return Math.max(1, Math.round(Math.abs(diff / rate)));
}

/** Suggested meal times: `count` meals, `gap` hours apart, starting at wake. */
/**
 * A first-draft eating schedule: `count` meals, `gap` hours apart, from wake.
 *
 * Any count is valid — two meals inside a short window and eight small ones are
 * both real ways people eat. Nothing downstream assumes a number; this only
 * decides where the list starts before the user edits it.
 */
const SCHEDULE_NAMES = {
  1: ["One meal"],
  2: ["First meal", "Second meal"],
  3: ["Breakfast", "Lunch", "Dinner"],
  4: ["Breakfast", "Lunch", "Snack", "Dinner"],
  5: ["Breakfast", "Second breakfast", "Lunch", "Snack", "Dinner"],
  6: ["Breakfast", "Second breakfast", "Lunch", "Snack", "Dinner", "Late meal"],
  7: ["Breakfast", "Second breakfast", "Lunch", "Afternoon snack", "Dinner", "Evening snack", "Late meal"],
  8: ["Breakfast", "Second breakfast", "Mid-morning", "Lunch", "Afternoon snack", "Dinner", "Evening snack", "Late meal"]
};

export function mealSchedule(wake, count, gap = 3) {
  const n = Math.max(1, Math.min(12, Math.round(count) || 1));
  const [h, m] = String(wake || "08:00").split(":").map(Number);
  const start = (h || 0) * 60 + (m || 0);

  // Past eight meals a fixed three-hour gap runs past midnight, so the spacing
  // compresses to fit a 14-hour eating day instead.
  const spanMinutes = gap * 60 * (n - 1);
  const step = spanMinutes > 14 * 60 && n > 1 ? Math.round((14 * 60) / (n - 1)) : gap * 60;

  const names = SCHEDULE_NAMES[n] || [];
  return Array.from({ length: n }, (_, i) => {
    const t = start + i * step;
    const hh = String(Math.floor(t / 60) % 24).padStart(2, "0");
    const mm = String(t % 60).padStart(2, "0");
    return { id: `m${i + 1}`, name: names[i] || `Meal ${i + 1}`, time: `${hh}:${mm}` };
  });
}

/* ── keeping the four numbers honest ─────────────────────── */

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

/** What the three macros actually add up to, in calories. */
export function macroKcal({ protein, carbs, fat }) {
  return Math.round((protein || 0) * 4 + (carbs || 0) * 4 + (fat || 0) * 9);
}

/**
 * Rebalance a target set after the user edits one number, so protein, carbs and
 * fat always reconcile with the calorie target.
 *
 * Whichever macro you did NOT touch absorbs the difference: carbs normally,
 * because they are the least biologically load-bearing of the three, and fat
 * when carbs are what you edited. If absorbing would drive the balancer below
 * zero, it floors at zero and the calorie target moves instead — the alternative
 * is silently rewriting a number the user just typed.
 */
export function balanceMacros(prev, changed, rawValue) {
  const v = Math.max(0, Math.round(Number(rawValue) || 0));
  const next = { ...prev, [changed]: v };

  // Fat has a floor: below roughly 15% of calories, hormones and satiety suffer.
  const fatFloor = Math.max(20, Math.round((next.kcal * 0.15) / 9));

  if (changed === "kcal") {
    const rest = next.kcal - next.protein * 4 - next.fat * 9;
    if (rest >= 0) {
      next.carbs = Math.round(rest / 4);
    } else {
      // Not enough room even at zero carbs — pull fat down to the floor first.
      next.carbs = 0;
      next.fat = Math.max(fatFloor, Math.round((next.kcal - next.protein * 4) / 9));
      const stillOver = next.protein * 4 + next.fat * 9 - next.kcal;
      if (stillOver > 0) next.protein = Math.max(0, Math.round((next.kcal - next.fat * 9) / 4));
    }
    return next;
  }

  const balancer = changed === "carbs" ? "fat" : "carbs";
  const others = ["protein", "carbs", "fat"].filter(k => k !== balancer);
  const spent = others.reduce((a, k) => a + next[k] * KCAL_PER_G[k], 0);
  const left = next.kcal - spent;

  if (left >= 0) {
    next[balancer] = Math.round(left / KCAL_PER_G[balancer]);
  } else {
    // The edit alone already exceeds the calorie target: zero the balancer and
    // raise calories to match, rather than quietly undoing what was typed.
    next[balancer] = 0;
    next.kcal = macroKcal(next);
  }
  return next;
}

/** Percentage of calories coming from each macro, for the split bar. */
export function macroSplit({ kcal, protein, carbs, fat }) {
  const total = macroKcal({ protein, carbs, fat }) || kcal || 1;
  return {
    protein: Math.round((protein * 4 / total) * 100),
    carbs: Math.round((carbs * 4 / total) * 100),
    fat: Math.round((fat * 9 / total) * 100)
  };
}

/**
 * Whole grams can never hit a calorie target exactly — one gram of carbs is
 * 4 kcal, so a few calories of rounding drift is arithmetic, not an error.
 * Anything inside a dozen calories counts as reconciled.
 */
export function macrosReconcile(t) {
  const sum = macroKcal(t);
  const diff = sum - (t.kcal || 0);
  return { sum, diff, ok: Math.abs(diff) <= 12 };
}
