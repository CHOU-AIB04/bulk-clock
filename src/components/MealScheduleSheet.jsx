import React, { useState } from "react";
import { X, Plus, Trash2, Clock, AlertTriangle, Wand2, ArrowRight } from "lucide-react";
import {
  useStore, addSlot, updateSlot, removeSlot, entriesInSlot,
  applyMealPreset, respaceSlots, toMinutes
} from "../lib/store.js";

/**
 * The meal schedule, entirely on the user's terms.
 *
 * Four meals is a default, not a rule. Someone eating six times a day and
 * someone eating twice inside an eight-hour window are both using this app
 * correctly, so the number, the names and the times are all theirs to set — and
 * every reminder, check-in row and Today timeline follows from this one list.
 */
export default function MealScheduleSheet({ onClose }) {
  const slots = useStore(s => s.profile.slots);
  const wakeTime = useStore(s => s.profile.wakeTime) || "08:00";
  const [removing, setRemoving] = useState(null);
  const [spread, setSpread] = useState({ start: wakeTime, gap: 3 });

  const first = slots[0];
  const last = slots[slots.length - 1];
  const windowHours = slots.length > 1
    ? Math.round(((toMinutes(last.time) - toMinutes(first.time)) / 60) * 10) / 10
    : 0;

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />

        <div className="sheet-h">
          <Clock size={20} style={{ color: "var(--accent-text)" }} />
          <h3 className="h3 grow" style={{ margin: 0 }}>Meal schedule</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        {removing ? (
          <>
            <p className="note danger" style={{ marginBottom: 16 }}>
              <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              <b>Delete “{removing.name}”?</b>{" "}
              {removing.count > 0
                ? <>You have {removing.count} item{removing.count === 1 ? "" : "s"} logged against it across your history. Choose where they should go — nothing is thrown away.</>
                : <>Nothing is logged against it, so this just removes the slot.</>}
            </p>

            {removing.count > 0 && (
              <label className="field">
                <span className="lab">Move that food to</span>
                <select
                  className="input" value={removing.moveTo}
                  onChange={e => setRemoving({ ...removing, moveTo: e.target.value })}
                >
                  {slots.filter(s => s.id !== removing.id).map(s => (
                    <option key={s.id} value={s.id}>{s.name} · {s.time}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="row" style={{ gap: 10 }}>
              <button
                className="btn btn-danger grow"
                onClick={() => { removeSlot(removing.id, removing.moveTo); setRemoving(null); }}
              >
                <Trash2 size={17} /> Delete the slot
              </button>
              <button className="btn btn-quiet" onClick={() => setRemoving(null)}>Keep it</button>
            </div>
          </>
        ) : (
          <>
            <p className="note" style={{ marginBottom: 16 }}>
              <b>{slots.length} meal{slots.length === 1 ? "" : "s"} a day</b>
              {slots.length > 1 && <> across {windowHours} hours, {first.time} to {last.time}</>}.
              Everything follows this list — the Today timeline, the reminders and the daily check-in.
            </p>

            {slots.map((slot, i) => {
              const prev = i > 0 ? slots[i - 1] : null;
              const gapMin = prev ? toMinutes(slot.time) - toMinutes(prev.time) : null;
              return (
                <div className="card-sm" key={slot.id} style={{ marginBottom: 10 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="n-badge">{i + 1}</span>
                    <input
                      className="input grow" value={slot.name}
                      onChange={e => updateSlot(slot.id, { name: e.target.value })}
                      style={{ padding: "10px 12px", fontSize: 15 }}
                      aria-label={`Name of meal ${i + 1}`}
                    />
                    <button
                      className="icon-btn" disabled={slots.length <= 1}
                      aria-label={`Remove ${slot.name}`}
                      onClick={() => setRemoving({
                        id: slot.id,
                        name: slot.name,
                        count: entriesInSlot(slot.id),
                        moveTo: slots.find(s => s.id !== slot.id)?.id
                      })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="row" style={{ gap: 10, marginTop: 8, paddingLeft: 32 }}>
                    <input
                      className="input num" type="time" value={slot.time}
                      onChange={e => updateSlot(slot.id, { time: e.target.value })}
                      style={{ flex: "0 0 128px", padding: "9px 10px", fontSize: 15 }}
                      aria-label={`Time of ${slot.name}`}
                    />
                    <span className="dim" style={{ fontSize: 12 }}>
                      {gapMin == null
                        ? "first meal of the day"
                        : gapMin <= 0
                          ? "same time or earlier than the one above"
                          : `${Math.round((gapMin / 60) * 10) / 10} h after ${prev.name}`}
                    </span>
                  </div>
                </div>
              );
            })}

            <button className="btn btn-secondary btn-wide" style={{ marginTop: 6 }} onClick={() => addSlot()}>
              <Plus size={17} /> Add another meal
            </button>

            <div className="sect-h" style={{ marginTop: 28 }}>
              <h2 className="h4"><Wand2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Start from a pattern</h2>
            </div>
            <p className="note" style={{ marginBottom: 14 }}>
              Rebuilds the list at the number of meals you pick, spread across a 14-hour day.
              Names you've already set are kept, and food you've already logged is moved, not lost.
            </p>
            <div className="chips">
              {[2, 3, 4, 5, 6, 7, 8].map(n => (
                <button
                  key={n} className="chip" aria-pressed={slots.length === n}
                  onClick={() => applyMealPreset(n, wakeTime)}
                >
                  {n} meals
                </button>
              ))}
            </div>

            <div className="sect-h" style={{ marginTop: 28 }}>
              <h2 className="h4">Re-space the ones you have</h2>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <label className="field grow" style={{ marginBottom: 0 }}>
                <span className="lab">First meal</span>
                <input
                  className="input num" type="time" value={spread.start}
                  onChange={e => setSpread({ ...spread, start: e.target.value })}
                />
              </label>
              <label className="field grow" style={{ marginBottom: 0 }}>
                <span className="lab">Hours apart</span>
                <select
                  className="input" value={spread.gap}
                  onChange={e => setSpread({ ...spread, gap: Number(e.target.value) })}
                >
                  {[1.5, 2, 2.5, 3, 3.5, 4, 5].map(g => <option key={g} value={g}>{g} h</option>)}
                </select>
              </label>
              <button
                className="btn btn-quiet" style={{ alignSelf: "flex-end" }}
                onClick={() => respaceSlots(spread.start, spread.gap)}
              >
                <ArrowRight size={16} /> Apply
              </button>
            </div>

            <p className="note" style={{ marginTop: 18 }}>
              Meals sort themselves into clock order, so retiming one moves it up or down the list
              automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
