import React, { useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Trophy, Flame, Dumbbell, Scale, Beef } from "lucide-react";
import {
  useStore, todayKey, addDays, parseKey, weekStart, dayTotals, targetsFor,
  dayConsistency, weightSeries, sessionDoneSets, workoutFor
} from "../lib/store.js";
import { tonnage, checkPRs, prLabel } from "../lib/lifting.js";

const r0 = n => Math.round(n);
const shortDate = k => parseKey(k).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * What the week actually amounted to, and the one thing to change.
 *
 * Deliberately ends with a single recommendation. A review that lists eight
 * observations and no decision is a report; a review that names the next action
 * is coaching, and only one action at a time ever gets acted on.
 */
export default function WeeklyReview() {
  const state = useStore();
  const [offset, setOffset] = useState(0);

  const start = weekStart(addDays(todayKey(), -offset * 7));
  const keys = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = todayKey();
  const elapsed = keys.filter(k => k <= today);

  // ── nutrition
  const loggedDays = elapsed.filter(k => dayTotals(k).kcal > 0);
  const avgKcal = loggedDays.length
    ? loggedDays.reduce((s, k) => s + dayTotals(k).kcal, 0) / loggedDays.length
    : 0;
  const avgTarget = elapsed.length
    ? elapsed.reduce((s, k) => s + targetsFor(k).kcal, 0) / elapsed.length
    : 0;
  const avgProtein = loggedDays.length
    ? loggedDays.reduce((s, k) => s + dayTotals(k).p, 0) / loggedDays.length
    : 0;
  const proteinTarget = state.profile.pTarget;

  // ── training
  const planned = elapsed.filter(k => !!workoutFor(k)).length;
  const trained = elapsed.filter(k => dayConsistency(k).trainingDue && dayConsistency(k).trained).length;
  const weekTonnage = keys.reduce((sum, k) => {
    const ex = state.lifts[k]?.ex || {};
    return sum + Object.values(ex).reduce((n, rec) => n + tonnage(rec.sets), 0);
  }, 0);
  const hardSets = keys.reduce((n, k) => n + sessionDoneSets(k), 0);

  // ── records set this week
  const prs = [];
  for (const k of keys) {
    for (const name of Object.keys(state.lifts[k]?.ex || {})) {
      const label = prLabel(checkPRs(name, k));
      if (label) prs.push({ name, label, key: k });
    }
  }

  // ── weight
  const weights = weightSeries().filter(w => w.key >= start && w.key <= keys[6]);
  const weightChange = weights.length >= 2
    ? Math.round((weights[weights.length - 1].v - weights[0].v) * 100) / 100
    : null;

  // ── consistency
  const kept = elapsed.filter(k => dayConsistency(k).pct >= 0.8).length;

  const recommendation = pickRecommendation({
    state, avgKcal, avgTarget, avgProtein, proteinTarget,
    planned, trained, weightChange, kept, elapsed: elapsed.length, loggedDays: loggedDays.length
  });

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn btn-icon btn-quiet" onClick={() => setOffset(o => o + 1)} aria-label="Previous week">
          <ChevronLeft size={18} />
        </button>
        <div className="grow" style={{ textAlign: "center" }}>
          <div className="h4">{offset === 0 ? "This week" : offset === 1 ? "Last week" : `${offset} weeks ago`}</div>
          <div className="caps faint" style={{ marginTop: 3 }}>{shortDate(start)} – {shortDate(keys[6])}</div>
        </div>
        <button
          className="btn btn-icon btn-quiet" onClick={() => setOffset(o => Math.max(0, o - 1))}
          disabled={offset === 0} aria-label="Next week"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid2">
        <div className="card-sm">
          <Flame size={17} style={{ color: "var(--accent-text)" }} />
          <div className="caps faint" style={{ fontSize: 10, marginTop: 10 }}>Average intake</div>
          <div className="stat-sm" style={{ marginTop: 6 }}>
            {r0(avgKcal)}<span className="dim" style={{ fontSize: 11, fontWeight: 400 }}> kcal</span>
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
            {avgTarget ? `${avgKcal >= avgTarget ? "+" : ""}${r0(avgKcal - avgTarget)} vs target` : "—"}
            {loggedDays.length < elapsed.length && ` · ${loggedDays.length}/${elapsed.length} days logged`}
          </div>
        </div>

        <div className="card-sm">
          <Beef size={17} style={{ color: "var(--accent-text)" }} />
          <div className="caps faint" style={{ fontSize: 10, marginTop: 10 }}>Average protein</div>
          <div className="stat-sm" style={{ marginTop: 6 }}>
            {r0(avgProtein)}<span className="dim" style={{ fontSize: 11, fontWeight: 400 }}> g</span>
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
            {proteinTarget ? `${Math.round((avgProtein / proteinTarget) * 100)}% of ${proteinTarget} g` : "—"}
          </div>
        </div>

        <div className="card-sm">
          <Dumbbell size={17} style={{ color: "var(--accent-text)" }} />
          <div className="caps faint" style={{ fontSize: 10, marginTop: 10 }}>Sessions</div>
          <div className="stat-sm" style={{ marginTop: 6 }}>
            {trained}<span className="dim" style={{ fontSize: 11, fontWeight: 400 }}> / {planned}</span>
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
            {hardSets} hard sets · {Math.round(weekTonnage).toLocaleString()} kg
          </div>
        </div>

        <div className="card-sm">
          <Scale size={17} style={{ color: "var(--accent-text)" }} />
          <div className="caps faint" style={{ fontSize: 10, marginTop: 10 }}>Weight</div>
          <div className="stat-sm" style={{ marginTop: 6 }}>
            {weightChange == null ? "—" : `${weightChange >= 0 ? "+" : ""}${weightChange}`}
            <span className="dim" style={{ fontSize: 11, fontWeight: 400 }}> kg</span>
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
            {weights.length ? `${weights.length} weigh-in${weights.length === 1 ? "" : "s"}` : "none logged"}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <span className="caps faint grow">Days kept</span>
          <span className="stat-sm">{kept}<span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> / {elapsed.length}</span></span>
        </div>
        <div className="bar" style={{ marginTop: 12 }}>
          <i style={{ width: `${elapsed.length ? (kept / elapsed.length) * 100 : 0}%` }} />
        </div>
      </div>

      {prs.length > 0 && (
        <>
          <div className="sect-h" style={{ marginTop: 24 }}>
            <h2 className="h4"><Trophy size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Records this week</h2>
            <span className="caps faint">{prs.length}</span>
          </div>
          {prs.slice(0, 6).map((pr, i) => (
            <div className="entry" key={i}>
              <span className="grow" style={{ fontSize: 14 }}>{pr.name}</span>
              <span className="neon" style={{ fontSize: 13, fontWeight: 600 }}>{pr.label}</span>
            </div>
          ))}
        </>
      )}

      <div className="glass lit" style={{ marginTop: 20 }}>
        <div className="row" style={{ marginBottom: 10 }}>
          <CalendarCheck size={19} style={{ color: "var(--accent-text)" }} />
          <span className="h4 neon">Next week, change one thing</span>
        </div>
        <div className="body-lg" style={{ fontWeight: 600 }}>{recommendation.title}</div>
        <p className="dim" style={{ fontSize: 14, marginTop: 6, marginBottom: 0 }}>{recommendation.body}</p>
      </div>
    </div>
  );
}

/**
 * One recommendation, chosen by severity: logging first (without it nothing else
 * can be judged), then attendance, then protein, then the calorie/weight
 * relationship. Never more than one.
 */
function pickRecommendation(d) {
  const { state } = d;

  if (d.elapsed >= 3 && d.loggedDays < d.elapsed * 0.6) {
    return {
      title: "Log more days before changing anything",
      body: `Only ${d.loggedDays} of ${d.elapsed} days have food logged. Every other number here is guesswork until that's closer to all of them — and a day logged roughly beats a day not logged at all.`
    };
  }

  if (d.planned > 0 && d.trained < d.planned) {
    const missed = d.planned - d.trained;
    return {
      title: `Make the ${missed} missed session${missed === 1 ? "" : "s"} the priority`,
      body: `You trained ${d.trained} of ${d.planned}. Nothing in the diet matters as much as showing up — if the schedule keeps losing, move those sessions to times you can actually make in the programme editor.`
    };
  }

  if (d.proteinTarget && d.avgProtein < d.proteinTarget * 0.85) {
    const short = Math.round(d.proteinTarget - d.avgProtein);
    return {
      title: `Add ${short} g of protein a day`,
      body: `You averaged ${Math.round(d.avgProtein)} g against ${d.proteinTarget} g. That's roughly ${Math.max(1, Math.round(short / 25))} extra palm-sized portion${Math.round(short / 25) === 1 ? "" : "s"} — the single highest-value change on this list.`
    };
  }

  const objective = state.profile.objective;
  if (d.weightChange != null) {
    if (objective === "build" && d.weightChange < 0.1) {
      return {
        title: "Add about 150 kcal a day",
        body: `The scale moved ${d.weightChange >= 0 ? "+" : ""}${d.weightChange} kg, which is short of the ~0.35 kg a week a build wants. Add roughly 150 kcal — most easily as carbohydrate around training — and give it two weeks before judging again.`
      };
    }
    if (objective === "build" && d.weightChange > 0.6) {
      return {
        title: "Take about 150 kcal back off",
        body: `You gained ${d.weightChange} kg this week. Faster than ~0.4 kg is mostly fat past this point. Trim around 150 kcal and check your waist measurement — that's the number that tells you which kind of weight it was.`
      };
    }
    if (objective === "lose" && d.weightChange > -0.2) {
      return {
        title: "Trim about 200 kcal a day",
        body: `The scale barely moved (${d.weightChange >= 0 ? "+" : ""}${d.weightChange} kg). Either intake is higher than logged or maintenance is higher than assumed — cut 200 kcal and keep protein where it is.`
      };
    }
  }

  if (d.weightChange == null && state.settings.trackWeight) {
    return {
      title: "Weigh in a few times next week",
      body: "Without weigh-ins the app can't tell whether your calorie target is right, and can't measure your real maintenance. Three or four mornings is enough — same conditions each time."
    };
  }

  if (d.kept === d.elapsed && d.elapsed >= 5) {
    return {
      title: "Change nothing",
      body: `You kept all ${d.elapsed} days. This is what a week that's working looks like — the correct response is to run it again, not to optimise it.`
    };
  }

  return {
    title: "Hold the plan for another week",
    body: "Nothing in this week's numbers argues for a change. Consistency compounds; adjust when two weeks of data point the same way, not one."
  };
}
