/**
 * The arithmetic that turns a logbook into a training system.
 *
 * Nothing here is a model or a guess dressed up as one: an estimated 1RM is a
 * published formula with known error bars, a PR is a comparison against your own
 * history, and the overload suggestion is the double-progression rule the app
 * already tells you to follow, applied automatically instead of by memory.
 */

import { EXERCISES } from "../data/program.js";
import { historyFor, lastSessionFor, setsFor } from "./store.js";

const EX_BY_NAME = Object.fromEntries(EXERCISES.map(e => [e.name.toLowerCase(), e]));

/**
 * Epley's estimate. Accurate to within a few percent up to about 10 reps and
 * increasingly optimistic beyond that, which is why anything past 12 reps is not
 * used for records.
 */
export function epley(weight, reps) {
  if (!(weight > 0) || !(reps > 0)) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export const E1RM_REP_CAP = 12;

/** The set with the highest estimated 1RM, ignoring rep counts too high to trust. */
export function bestSet(sets) {
  let best = null;
  for (const s of sets || []) {
    if (s.type === "warmup" || s.w == null || s.r == null || s.r > E1RM_REP_CAP) continue;
    const e = epley(s.w, s.r);
    if (!best || e > best.e1rm) best = { w: s.w, r: s.r, e1rm: e };
  }
  return best;
}

/** Total load moved in a session: weight × reps, work sets only. */
export function tonnage(sets) {
  return (sets || []).reduce(
    (n, s) => (s.type === "warmup" || s.w == null || s.r == null ? n : n + s.w * s.r),
    0
  );
}

/* ── records ─────────────────────────────────────────────── */

/**
 * Which records today's sets broke for this exercise.
 *
 * Three separate records, because lifters care about all three and they move
 * independently: the heaviest weight ever touched, the most reps ever done at
 * that weight, and the best estimated 1RM.
 */
export function checkPRs(exercise, dateKey) {
  const today = setsFor(dateKey, exercise).filter(s => s.type !== "warmup" && s.w != null && s.r != null);
  if (!today.length) return null;

  const past = historyFor(exercise).filter(h => h.key < dateKey);
  if (!past.length) {
    // A first session sets the baseline; calling everything a record on day one
    // would make the badge meaningless.
    return { first: true, weight: null, reps: null, e1rm: null };
  }

  const pastSets = past.flatMap(h => h.sets);
  const prevMaxWeight = Math.max(...pastSets.map(s => s.w));
  const prevBest = bestSet(pastSets);
  const prevE1rm = prevBest?.e1rm || 0;

  const todayMaxWeight = Math.max(...today.map(s => s.w));
  const todayBest = bestSet(today);
  const todayE1rm = todayBest?.e1rm || 0;

  const weightPR = todayMaxWeight > prevMaxWeight ? { from: prevMaxWeight, to: todayMaxWeight } : null;

  // Reps at a weight you have lifted before — the record that moves most often.
  let repsPR = null;
  for (const s of today) {
    const sameWeight = pastSets.filter(p => Math.abs(p.w - s.w) < 0.01);
    if (!sameWeight.length) continue;
    const prevReps = Math.max(...sameWeight.map(p => p.r));
    if (s.r > prevReps && (!repsPR || s.r - prevReps > repsPR.to - repsPR.from)) {
      repsPR = { weight: s.w, from: prevReps, to: s.r };
    }
  }

  const e1rmPR = todayE1rm > prevE1rm + 0.01
    ? { from: prevE1rm, to: todayE1rm }
    : null;

  if (!weightPR && !repsPR && !e1rmPR) return null;
  return { first: false, weight: weightPR, reps: repsPR, e1rm: e1rmPR };
}

/** A one-line summary of a record, for a badge. */
export function prLabel(pr) {
  if (!pr || pr.first) return null;
  if (pr.weight) return `${pr.weight.to} kg — heaviest yet`;
  if (pr.reps) return `${pr.reps.to} reps at ${pr.reps.weight} kg`;
  if (pr.e1rm) return `est. 1RM ${pr.e1rm.to.toFixed(1)} kg`;
  return null;
}

/* ── progression ─────────────────────────────────────────── */

/** "8–10", "10-12", "5", "8–10 ea", "45 s" → { min, max } or null for timed work. */
export function parseRepRange(reps) {
  const text = String(reps || "").replace(/–|—/g, "-");
  if (/s$|sec|min/i.test(text)) return null;             // a hold, not a rep range
  const nums = text.match(/\d+/g);
  if (!nums || !nums.length) return null;
  const min = Number(nums[0]);
  const max = nums.length > 1 ? Number(nums[1]) : min;
  return { min, max };
}

/** Lower-body lifts take bigger jumps than upper-body ones. */
export function loadStep(exerciseName) {
  const meta = EX_BY_NAME[String(exerciseName || "").toLowerCase()];
  if (meta?.muscle === "Legs") return 5;
  if (meta?.muscle === "Back" && /deadlift/i.test(exerciseName)) return 5;
  return 2.5;
}

/**
 * Double progression, applied for you.
 *
 * Hold the load until every work set reaches the top of the prescribed range,
 * then add weight and start again at the bottom. The suggestion always explains
 * itself, because a number that appears in a box without a reason gets ignored.
 */
export function suggestLoad(exerciseName, prescribedReps, dateKey) {
  const range = parseRepRange(prescribedReps);
  const prev = lastSessionFor(exerciseName, dateKey);
  if (!prev) return null;

  const sets = prev.sets.filter(s => s.type !== "warmup" && s.w != null && s.r != null);
  if (!sets.length) return null;

  const load = Math.max(...sets.map(s => s.w));
  const atLoad = sets.filter(s => Math.abs(s.w - load) < 0.01);
  if (!range) {
    return { weight: load, reason: `Same as last time (${load} kg).`, kind: "hold" };
  }

  const allTopped = atLoad.length > 0 && atLoad.every(s => s.r >= range.max);
  const anyShort = atLoad.some(s => s.r < range.min);
  const step = loadStep(exerciseName);

  if (allTopped) {
    return {
      weight: Math.round((load + step) * 2) / 2,
      reason: `Every set hit ${range.max} last time — add ${step} kg and work back up from ${range.min}.`,
      kind: "up"
    };
  }
  if (anyShort) {
    return {
      weight: load,
      reason: `A set fell below ${range.min} last time. Hold ${load} kg until all of them clear it.`,
      kind: "hold-low"
    };
  }
  return {
    weight: load,
    reason: `You're mid-range at ${load} kg. Stay there and add reps until every set reaches ${range.max}.`,
    kind: "hold"
  };
}

/* ── weekly volume ───────────────────────────────────────── */

/** Which muscle a movement trains, falling back to a keyword read of its name. */
export function muscleOf(exerciseName) {
  const meta = EX_BY_NAME[String(exerciseName || "").toLowerCase()];
  if (meta) return meta.muscle;
  // Word boundaries matter here: a bare /ab/ matches "unrecognisable", and a
  // custom movement was being filed under Core because of it.
  const n = String(exerciseName || "").toLowerCase();
  if (/\b(squat|leg|legs|lunge|calf|calves|deadlift|glute|glutes|hip thrust|rdl)\b/.test(n)) return "Legs";
  if (/\b(bench|chest|fly|flye|dip|dips|push-?ups?|pec)\b/.test(n)) return "Chest";
  if (/\b(row|rows|pull-?ups?|pulldown|lat|lats|chin-?ups?|shrug|shrugs)\b/.test(n)) return "Back";
  if (/\b(shoulder|shoulders|overhead|lateral|delt|delts|face pull|upright row)\b/.test(n)) return "Shoulders";
  if (/\b(curl|curls|tricep|triceps|bicep|biceps|skull|pushdown|extension)\b/.test(n)) return "Arms";
  if (/\b(crunch|crunches|plank|abs?|core|twist|rollout|sit-?ups?)\b/.test(n)) return "Core";
  if (/\b(run|running|bike|cycling|row erg|jump rope|burpee|cardio|treadmill)\b/.test(n)) return "Cardio";
  return "Other";
}

/**
 * Hard sets per muscle over a date range. The 10–20 weekly set band is the
 * usual landmark for hypertrophy; below it progress is slow, far above it
 * recovery becomes the limit rather than stimulus.
 */
export const VOLUME_LANDMARK = { low: 10, high: 20 };

export function volumeByMuscle(lifts, keys) {
  const out = {};
  for (const key of keys) {
    const ex = lifts[key]?.ex || {};
    for (const [name, rec] of Object.entries(ex)) {
      const hard = (rec.sets || []).filter(s => s.done && s.type !== "warmup").length;
      if (!hard) continue;
      const muscle = muscleOf(name);
      out[muscle] = (out[muscle] || 0) + hard;
    }
  }
  return out;
}
