import React, { useMemo, useState } from "react";
import { X, ArrowRight, Check, Flag, Dumbbell, Flame, Target, Info, ChevronLeft } from "lucide-react";
import { useStore, setProfile, todayKey, weightSeries, rollingAvg } from "../lib/store.js";
import { OBJECTIVES, computeTargets, weeksToGoal, macrosReconcile } from "../lib/targets.js";
import { weightUnit, toDisplayWeight, fromDisplayWeight } from "../lib/units.js";

const OBJ_ICON = { build: Dumbbell, lose: Flame, maintain: Target };

/**
 * Changing what you're training for, without losing what you've done.
 *
 * Reaching a goal weight or switching from a bulk to a cut used to mean editing
 * six fields one at a time, or resetting the app. This recalculates everything
 * from your CURRENT numbers — not the ones you signed up with — restarts the
 * trajectory from today, and leaves every logged meal, set and photo untouched.
 */
export default function GoalSwitcher({ onClose }) {
  const profile = useStore(s => s.profile);
  const [step, setStep] = useState(1);

  // The trend average is a better "current weight" than the last single reading,
  // which can be a kilo out on water alone.
  const trend = rollingAvg(7, 0);
  const series = weightSeries();
  const measured = trend ?? (series.length ? series[series.length - 1].v : profile.weight);

  const [draft, setDraft] = useState(() => ({
    objective: profile.objective,
    weight: Math.round(measured * 10) / 10,
    goalWeight: profile.goalWeight
  }));

  const next = useMemo(
    () => computeTargets({ ...profile, ...draft }),
    [profile, draft]
  );
  const weeks = weeksToGoal({ ...profile, ...draft });
  const obj = OBJECTIVES.find(o => o.id === draft.objective);

  const deltaKcal = next.kcal - profile.kcalTarget;
  const toGo = Math.abs(draft.goalWeight - draft.weight);
  const directionOk = draft.objective === "maintain"
    || (draft.objective === "build" && draft.goalWeight > draft.weight)
    || (draft.objective === "lose" && draft.goalWeight < draft.weight);

  function apply() {
    setProfile({
      objective: draft.objective,
      weight: draft.weight,
      goalWeight: draft.goalWeight,
      // A new goal means a new trajectory: the chart should start from here.
      startWeight: draft.weight,
      programStart: todayKey(),
      kcalTarget: next.kcal,
      pTarget: next.protein,
      cTarget: next.carbs,
      fTarget: next.fat
    });
    onClose();
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />

        <div className="sheet-h">
          {step === 2
            ? <button className="btn-ghost" onClick={() => setStep(1)} aria-label="Back"><ChevronLeft size={22} /></button>
            : <Flag size={20} style={{ color: "var(--accent-text)" }} />}
          <h3 className="h3 grow" style={{ margin: 0 }}>{step === 1 ? "New goal" : "Your new targets"}</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        {step === 1 ? (
          <>
            <p className="note" style={{ marginBottom: 18 }}>
              Everything you've logged stays exactly where it is. This only recalculates your targets
              from where you are <b>now</b>, and restarts the weight trajectory from today.
            </p>

            <div className="sect-h" style={{ marginBottom: 12 }}><h2 className="h4">What now</h2></div>
            <div style={{ display: "grid", gap: 10 }}>
              {OBJECTIVES.map(o => {
                const Ico = OBJ_ICON[o.id];
                return (
                  <button
                    key={o.id} className="pick" aria-pressed={draft.objective === o.id}
                    onClick={() => setDraft({ ...draft, objective: o.id })}
                  >
                    <span className="pick-ico"><Ico size={21} /></span>
                    <span className="grow">
                      <span className="pick-t">{o.label}</span>
                      <span className="pick-d">{o.desc}</span>
                    </span>
                    <span className="pick-mark">{draft.objective === o.id ? <Check size={20} /> : null}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid2" style={{ marginTop: 20 }}>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="lab">Weight now ({weightUnit()})</span>
                <input
                  className="input num" type="number" inputMode="decimal" step="0.1"
                  value={toDisplayWeight(draft.weight) ?? ""}
                  onChange={e => setDraft({ ...draft, weight: fromDisplayWeight(e.target.value) ?? 0 })}
                />
              </label>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="lab">Goal ({weightUnit()})</span>
                <input
                  className="input num" type="number" inputMode="decimal" step="0.1"
                  value={toDisplayWeight(draft.goalWeight) ?? ""}
                  onChange={e => setDraft({ ...draft, goalWeight: fromDisplayWeight(e.target.value) ?? 0 })}
                />
              </label>
            </div>

            {trend != null && (
              <p className="dim" style={{ fontSize: 12.5, marginTop: 10 }}>
                Your 7-day trend average is {toDisplayWeight(trend)} {weightUnit()} — a better reading
                than any single morning, which can be a kilo out on water alone.
              </p>
            )}

            {!directionOk && draft.objective !== "maintain" && (
              <p className="note warn" style={{ marginTop: 14 }}>
                Your goal is {draft.objective === "build" ? "below" : "above"} your current weight,
                which contradicts {obj.label.toLowerCase()}. Either flip the objective or change the
                goal.
              </p>
            )}

            <button
              className="btn btn-primary btn-wide" style={{ marginTop: 20 }}
              disabled={!directionOk || !(draft.weight > 0) || !(draft.goalWeight > 0)}
              onClick={() => setStep(2)}
            >
              See the new targets <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <>
            <div className="hero">
              <div className="row" style={{ position: "relative", zIndex: 1 }}>
                <div className="grow">
                  <div className="caps">New daily target</div>
                  <div className="stat-xl" style={{ marginTop: 10 }}>{next.kcal}</div>
                  <div style={{ fontSize: 14, marginTop: 8, color: "rgba(16,22,10,.66)", fontWeight: 600 }}>
                    {deltaKcal === 0 ? "unchanged" : `${deltaKcal > 0 ? "+" : ""}${deltaKcal} vs your current ${profile.kcalTarget}`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="caps">{obj.caps}</div>
                  <div style={{ fontSize: 13, marginTop: 6, color: "rgba(16,22,10,.66)", fontWeight: 600 }}>{obj.pace}</div>
                </div>
              </div>
            </div>

            <div className="grid3" style={{ marginTop: 14 }}>
              {[["Protein", next.protein], ["Carbs", next.carbs], ["Fat", next.fat]].map(([l, v]) => (
                <div className="card-sm" key={l} style={{ padding: 14 }}>
                  <div className="caps faint" style={{ fontSize: 10 }}>{l}</div>
                  <div className="stat-sm" style={{ marginTop: 6 }}>{v}<span className="dim" style={{ fontSize: 11, fontWeight: 400 }}> g</span></div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <div className="caps faint" style={{ marginBottom: 10 }}>What changes</div>
              {[
                ["Objective", `${OBJECTIVES.find(o => o.id === profile.objective)?.label} → ${obj.label}`],
                ["Goal weight", `${toDisplayWeight(profile.goalWeight)} → ${toDisplayWeight(draft.goalWeight)} ${weightUnit()}`],
                ["Trajectory", `restarts today from ${toDisplayWeight(draft.weight)} ${weightUnit()}`],
                ["Time to goal", weeks ? `about ${weeks} weeks (${toDisplayWeight(toGo)} ${weightUnit()} to go)` : "—"]
              ].map(([k, v]) => (
                <div className="entry" key={k}>
                  <span className="grow dim" style={{ fontSize: 13.5 }}>{k}</span>
                  <span style={{ fontSize: 13.5, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>

            <p className="note" style={{ marginTop: 14 }}>
              <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              Nothing you've logged is touched — meals, sets, photos and measurements all stay. Only
              the targets and the trajectory line move. If you've been logging for a few weeks, check
              the measured maintenance on this tab afterwards; it beats the formula.
            </p>

            <button className="btn btn-primary btn-wide" style={{ marginTop: 18 }} onClick={apply}>
              <Check size={17} /> Switch to {obj.label.toLowerCase()}
            </button>
            <button className="btn btn-ghost btn-wide" style={{ marginTop: 8 }} onClick={onClose}>
              Keep what I have
            </button>
          </>
        )}
      </div>
    </div>
  );
}
