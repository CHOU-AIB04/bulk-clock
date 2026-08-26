import React from "react";
import { BarChart3, Info } from "lucide-react";
import { useStore, todayKey, addDays, weekStart, workoutFor } from "../lib/store.js";
import { volumeByMuscle, muscleOf, VOLUME_LANDMARK } from "../lib/lifting.js";

const ORDER = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Cardio", "Other"];

/**
 * Hard sets per muscle over the last seven days.
 *
 * The 10–20 set band is the usual hypertrophy landmark: under it progress is
 * slow, far over it recovery becomes the limit rather than stimulus. Showing it
 * as a band rather than a single number matters — there is no exact right
 * answer, and a bar that turns green at exactly 12 would be lying.
 */
export default function VolumePanel() {
  const lifts = useStore(s => s.lifts);
  const program = useStore(s => s.program);

  const keys = Array.from({ length: 7 }, (_, i) => addDays(todayKey(), -i));
  const done = volumeByMuscle(lifts, keys);

  // What the programme asks for in a full week, as the comparison line.
  const planned = {};
  for (const day of Object.values(program.days || {})) {
    for (const e of day.ex || []) {
      const m = muscleOf(e.name);
      planned[m] = (planned[m] || 0) + (e.sets || 0);
    }
  }

  const muscles = ORDER.filter(m => done[m] || planned[m]);
  const totalSets = Object.values(done).reduce((a, b) => a + b, 0);

  if (!muscles.length) {
    return (
      <div className="empty">
        <span className="empty-ico"><BarChart3 size={24} /></span>
        No sets logged in the last seven days. Volume appears here as you train.
      </div>
    );
  }

  const max = Math.max(VOLUME_LANDMARK.high + 4, ...muscles.map(m => Math.max(done[m] || 0, planned[m] || 0)));

  return (
    <div>
      <div className="card-sm" style={{ marginBottom: 14 }}>
        <div className="row">
          <BarChart3 size={19} style={{ color: "var(--accent-text)" }} />
          <span className="grow">
            <span className="caps faint" style={{ display: "block", fontSize: 10 }}>Hard sets, last 7 days</span>
            <span className="stat-sm" style={{ display: "block", marginTop: 5 }}>{totalSets}</span>
          </span>
        </div>
      </div>

      {muscles.map(m => {
        const v = done[m] || 0;
        const plan = planned[m] || 0;
        const pct = (v / max) * 100;
        const lowPct = (VOLUME_LANDMARK.low / max) * 100;
        const highPct = (VOLUME_LANDMARK.high / max) * 100;

        const state = m === "Cardio" || m === "Core" || m === "Other"
          ? "neutral"
          : v < VOLUME_LANDMARK.low ? "under" : v > VOLUME_LANDMARK.high ? "over" : "in";

        return (
          <div className="card-sm" key={m} style={{ marginBottom: 9 }}>
            <div className="row" style={{ alignItems: "baseline" }}>
              <span className="h4 grow">{m}</span>
              <span className="stat-sm tnum">{v}</span>
              <span className="dim" style={{ fontSize: 11.5 }}>
                {plan ? `of ${plan} planned` : "sets"}
              </span>
            </div>

            <div className="vol-bar" style={{ marginTop: 10 }}>
              <span className="band" style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }} />
              <i
                style={{
                  width: `${Math.min(100, pct)}%`,
                  background: state === "under" ? "var(--warn)" : state === "over" ? "var(--info)" : "var(--accent)"
                }}
              />
            </div>

            <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
              {state === "under" && `Below the 10-set landmark — this one is being under-trained.`}
              {state === "in" && `Inside the 10–20 set band where most growth happens.`}
              {state === "over" && `Above 20 sets. Fine for a block, but recovery becomes the limit.`}
              {state === "neutral" && `No set landmark for this one — train it to taste.`}
            </div>
          </div>
        );
      })}

      <p className="note" style={{ marginTop: 14 }}>
        <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
        Only ticked work sets count — warm-ups are excluded. The shaded band is 10–20 sets a week,
        the range most of the evidence points at for growth. It is a landmark, not a rule.
      </p>
    </div>
  );
}
