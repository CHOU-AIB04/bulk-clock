/**
 * Rule-based insights. Every line the app shows is computed from data the user
 * actually logged — there is no model and no server behind this. The UI labels
 * them "Calculated from your data" for exactly that reason.
 *
 * Each rule returns null when it has nothing honest to say. Silence beats filler.
 */

import {
  dayTotals, todayKey, addDays, rollingAvg, weightSeries,
  currentStreak, getState, weekdayOf, workoutFor
} from "./store.js";

const r0 = n => Math.round(n);

/* ── individual rules ─────────────────────────────────── */

function weightTrend(s) {
  const series = weightSeries();
  const cur = rollingAvg(7, 0), prev = rollingAvg(7, 7);
  if (series.length < 14 || cur == null || prev == null) {
    return {
      id: "trend", tone: "neutral", tag: "Baseline",
      title: `${series.length} of 14 weigh-ins logged`,
      body: "Two full weeks of morning weights and I can tell you whether to hold, add or cut calories. Until then the targets are an estimate."
    };
  }
  const d = cur - prev;
  const goingUp = s.profile.objective !== "lose";
  const band = goingUp ? [0.25, 0.45] : [-0.75, -0.25];

  if (d >= band[0] && d <= band[1]) {
    return {
      id: "trend", tone: "good", tag: "On target",
      title: `${d >= 0 ? "+" : ""}${d.toFixed(2)} kg this week`,
      body: "Right inside the band you want. Change nothing — keep the calories where they are and keep adding weight to the bar."
    };
  }
  if (goingUp && d < 0.15) {
    return {
      id: "trend", tone: "warn", tag: "Stalled",
      title: `Only ${d >= 0 ? "+" : ""}${d.toFixed(2)} kg this week`,
      body: `Add about 200 kcal — 30 g of peanut butter, or 20 g more dry rice at two meals. If this is the second flat week, weigh your food for seven days before changing anything else.`
    };
  }
  if (goingUp && d > 0.7) {
    return {
      id: "trend", tone: "danger", tag: "Too fast",
      title: `+${d.toFixed(2)} kg this week`,
      body: "That is mostly fat and water. Cut roughly 200 kcal and re-check in seven days."
    };
  }
  if (!goingUp && d > -0.15) {
    return {
      id: "trend", tone: "warn", tag: "Stalled",
      title: `${d >= 0 ? "+" : ""}${d.toFixed(2)} kg this week`,
      body: "The deficit isn't landing. Trim about 200 kcal, or add 2,000 steps a day before touching food."
    };
  }
  return {
    id: "trend", tone: "neutral", tag: "Drifting",
    title: `${d >= 0 ? "+" : ""}${d.toFixed(2)} kg this week`,
    body: "Just outside the band. Single weeks are noisy — give it one more before adjusting."
  };
}

function proteinGap(s) {
  const days = [];
  for (let i = 1; i <= 7; i++) {
    const k = addDays(todayKey(), -i);
    const t = dayTotals(k);
    if (t.kcal > 0) days.push(t.p);
  }
  if (days.length < 4) return null;
  const avg = days.reduce((a, b) => a + b, 0) / days.length;
  const target = s.profile.pTarget;
  if (avg >= target * 0.92) {
    return {
      id: "protein", tone: "good", tag: "Protein",
      title: `Averaging ${r0(avg)} g a day`,
      body: `Against a ${target} g target across your last ${days.length} logged days. That is the part most people get wrong and you are not.`
    };
  }
  const short = r0(target - avg);
  return {
    id: "protein", tone: "warn", tag: "Protein",
    title: `${short} g short, most days`,
    body: `You're averaging ${r0(avg)} g against ${target} g. Roughly ${Math.ceil(short / 12)} × 125 g pot of Greek yogurt, or ${Math.ceil(short / 19)} extra eggs, closes it without much volume.`
  };
}

function stalledLift(s) {
  const byExercise = {};
  const keys = Object.keys(s.lifts).sort().slice(-24);
  for (const k of keys) {
    // Sessions are { ex: { name: { sets: [...] } } } — warm-ups never count as a
    // top set, or a light first set would read as a stall.
    for (const [name, rec] of Object.entries(s.lifts[k]?.ex || {})) {
      const working = (rec.sets || []).filter(x => x && x.type !== "warmup" && x.w != null);
      const top = Math.max(0, ...working.map(x => x.w));
      if (top > 0) (byExercise[name] ||= []).push({ k, top });
    }
  }
  for (const [name, hist] of Object.entries(byExercise)) {
    if (hist.length < 4) continue;
    const recent = hist.slice(-4);
    if (recent.every(h => h.top === recent[0].top)) {
      return {
        id: "lift", tone: "warn", tag: "Progression",
        title: `${name} hasn't moved in ${recent.length} sessions`,
        body: `Still at ${recent[0].top} kg. If you're hitting the top of the rep range on every set, add 2.5 kg upper / 5 kg lower now. If you aren't, that's a recovery or calorie problem, not a programme one.`
      };
    }
  }
  const climbing = Object.entries(byExercise).find(([, h]) => h.length >= 3 && h[h.length - 1].top > h[0].top);
  if (climbing) {
    const [name, h] = climbing;
    return {
      id: "lift", tone: "good", tag: "Progression",
      title: `${name} up ${(h[h.length - 1].top - h[0].top).toFixed(1)} kg`,
      body: `From ${h[0].top} to ${h[h.length - 1].top} kg over ${h.length} logged sessions. Strength climbing while the scale climbs is the signal that the weight you're gaining is worth having.`
    };
  }
  return null;
}

function todayReadiness(s) {
  const wo = workoutFor();
  const yesterday = dayTotals(addDays(todayKey(), -1));
  const ateWell = yesterday.kcal >= s.profile.kcalTarget * 0.9;

  if (!wo) {
    return {
      id: "ready", tone: "neutral", tag: "Rest day",
      title: "No session scheduled",
      body: "Eat the full target anyway. At your bodyweight recovery is the limiting factor, not training volume."
    };
  }
  if (yesterday.kcal === 0) {
    return {
      id: "ready", tone: "neutral", tag: "Session today",
      title: wo.name,
      body: "Nothing logged yesterday, so there's no fuel data to judge readiness on. Log as you go today and this gets useful."
    };
  }
  return {
    id: "ready", tone: ateWell ? "good" : "warn", tag: "Session today",
    title: wo.name,
    body: ateWell
      ? `You hit ${r0(yesterday.kcal)} kcal yesterday — you're fuelled for this. Push the top sets.`
      : `You only logged ${r0(yesterday.kcal)} kcal yesterday against ${s.profile.kcalTarget}. Expect the last sets to feel heavy; don't read that as losing strength.`
  };
}

function streakRisk(s) {
  const streak = currentStreak();
  if (streak < 3) return null;
  const t = dayTotals(todayKey());
  const left = s.profile.kcalTarget * 0.9 - t.kcal;
  if (left <= 0) return null;
  const hour = new Date().getHours();
  if (hour < 17) return null;
  return {
    id: "streak", tone: "warn", tag: "Streak",
    title: `${r0(left)} kcal from keeping a ${streak}-day streak`,
    body: "Still time. Your last meal plus anything calorie-dense closes it."
  };
}

function volumeBalance(s) {
  const t = dayTotals(todayKey());
  if (t.kcal < 200) return null;
  const pct = (t.p * 4) / t.kcal;
  if (pct < 0.15) {
    return {
      id: "balance", tone: "warn", tag: "Today's split",
      title: "Protein is thin so far today",
      body: `Only ${r0(pct * 100)}% of today's calories are protein. Weight the remaining meals toward meat, fish, eggs or yogurt.`
    };
  }
  return null;
}

/* ── assembly ─────────────────────────────────────────── */

/** Ordered, de-duplicated insights. Returns [] when there's genuinely nothing to say. */
export function getInsights(state = getState()) {
  return [
    todayReadiness(state),
    weightTrend(state),
    streakRisk(state),
    proteinGap(state),
    stalledLift(state),
    volumeBalance(state)
  ].filter(Boolean);
}

/** The single most useful line, for the dashboard hero card. */
export function headlineInsight(state = getState()) {
  const all = getInsights(state);
  const order = { danger: 0, warn: 1, good: 2, neutral: 3 };
  return [...all].sort((a, b) => order[a.tone] - order[b.tone])[0] || null;
}
