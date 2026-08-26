import React from "react";
import { Check, X, Dumbbell, Scale, Moon } from "lucide-react";
import {
  useStore, checkinFor, setMealCheck, setTrainedCheck, dayEntries,
  workoutFor, dayConsistency, setWeight
} from "../lib/store.js";

/**
 * The daily follow-up: did each meal actually happen, and did the session.
 *
 * A meal that already has food logged against it counts as eaten without being
 * asked twice — the question only exists for the meals you did not log. Answers
 * are three-state (unanswered / yes / no) and tapping the same answer clears it,
 * because a wrong tap should never be permanent.
 */
export default function CheckIn({ dateKey, compact = false }) {
  const slots = useStore(s => s.profile.slots);
  useStore(s => s.checkins);
  useStore(s => s.log);
  const trackWeight = useStore(s => s.settings.trackWeight);
  const weight = useStore(s => s.log[dateKey]?.weight ?? "");

  const ci = checkinFor(dateKey);
  const entries = dayEntries(dateKey);
  const logged = new Set(entries.map(e => e.slot));
  const wo = workoutFor(dateKey);
  const c = dayConsistency(dateKey);

  const trainedFromLifts = useStore(s =>
    Object.values(s.lifts[dateKey]?.ex || {}).some(rec =>
      (rec.sets || []).some(x => x.done && x.type !== "warmup")
    )
  );

  return (
    <div>
      {!compact && (
        <div className="sect-h">
          <h2 className="h3">Daily check-in</h2>
          <span className="caps faint">{c.hit} / {c.total} kept</span>
        </div>
      )}

      {slots.map(slot => {
        const auto = logged.has(slot.id) && ci.meals?.[slot.id] !== "no";
        const state = ci.meals?.[slot.id] === "no" ? "no" : (ci.meals?.[slot.id] === "yes" || auto) ? "yes" : "";
        return (
          <div className="checkrow" data-state={state} key={slot.id}>
            <span className="tick">
              {state === "no" ? <X size={16} strokeWidth={3} /> : <Check size={17} strokeWidth={3} />}
            </span>
            <span className="grow" style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{slot.name}</span>
              <span className="dim" style={{ display: "block", fontSize: 12, marginTop: 2 }}>
                {auto ? "Logged — counted as eaten" : state === "no" ? "Missed" : `Planned for ${slot.time}`}
              </span>
            </span>
            <span className="yesno">
              <button
                className="y" aria-pressed={state === "yes"} aria-label={`${slot.name} eaten`}
                onClick={() => setMealCheck(dateKey, slot.id, "yes")}
              >
                <Check size={17} strokeWidth={2.6} />
              </button>
              <button
                className="n" aria-pressed={state === "no"} aria-label={`${slot.name} missed`}
                onClick={() => setMealCheck(dateKey, slot.id, "no")}
              >
                <X size={17} strokeWidth={2.6} />
              </button>
            </span>
          </div>
        );
      })}

      {wo ? (
        <div className="checkrow" data-state={ci.trained === "no" ? "no" : (ci.trained === "yes" || trainedFromLifts) ? "yes" : ""}>
          <span className="tick">
            {ci.trained === "no" ? <X size={16} strokeWidth={3} /> : <Dumbbell size={16} strokeWidth={3} />}
          </span>
          <span className="grow" style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{wo.name}</span>
            <span className="dim" style={{ display: "block", fontSize: 12, marginTop: 2 }}>
              {trainedFromLifts ? "Sets logged — counted as trained" : ci.trained === "no" ? "Skipped" : "Did you train?"}
            </span>
          </span>
          <span className="yesno">
            <button className="y" aria-pressed={ci.trained === "yes"} aria-label="Trained" onClick={() => setTrainedCheck(dateKey, "yes")}>
              <Check size={17} strokeWidth={2.6} />
            </button>
            <button className="n" aria-pressed={ci.trained === "no"} aria-label="Did not train" onClick={() => setTrainedCheck(dateKey, "no")}>
              <X size={17} strokeWidth={2.6} />
            </button>
          </span>
        </div>
      ) : (
        <div className="checkrow" data-state="">
          <span className="tick" style={{ borderColor: "var(--outline-variant)" }}><Moon size={15} strokeWidth={2.6} /></span>
          <span className="grow">
            <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>Rest day</span>
            <span className="dim" style={{ display: "block", fontSize: 12, marginTop: 2 }}>Nothing scheduled — recovery counts as work</span>
          </span>
        </div>
      )}

      {trackWeight && (
        <label className="checkrow" style={{ cursor: "text" }}>
          <span className="tick" style={{ borderColor: weight !== "" ? "var(--accent)" : undefined, color: weight !== "" ? "var(--accent-text)" : "transparent" }}>
            <Scale size={15} strokeWidth={2.6} />
          </span>
          <span className="grow">
            <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>Weight, if you checked</span>
            <span className="dim" style={{ display: "block", fontSize: 12, marginTop: 2 }}>Optional — skip it as often as you like</span>
          </span>
          <input
            className="input num" inputMode="decimal" type="number" step="0.1"
            style={{ width: 92, textAlign: "center", padding: "10px 8px", marginLeft: "auto", flex: "0 0 92px" }}
            value={weight} placeholder="kg" aria-label="Weight in kilograms"
            onChange={e => setWeight(dateKey, e.target.value)}
          />
        </label>
      )}
    </div>
  );
}
