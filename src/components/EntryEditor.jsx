import React, { useState } from "react";
import { X, Trash2, ArrowRightLeft } from "lucide-react";
import { macrosFor } from "../data/foods.js";
import { useStore, getFood, updateEntry, moveEntry, removeEntry } from "../lib/store.js";
import FoodAvatar from "./FoodAvatar.jsx";

const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;

/**
 * Fix a logged entry instead of deleting and re-adding it.
 *
 * Amount, unit and which meal it belongs to are all editable. For an entry that
 * came from a food still in the database the macros are recalculated properly;
 * for a scanned product or a one-off custom entry they are scaled from the
 * snapshot, which is the honest best you can do once the source is gone.
 */
export default function EntryEditor({ dateKey, entry, onClose }) {
  const slots = useStore(s => s.profile.slots);
  const food = entry.ref ? getFood(entry.ref) : null;
  const editableUnits = food && entry.kind === "food" ? food.units : null;

  const [amount, setAmount] = useState(entry.amount);
  const [unit, setUnit] = useState(entry.unit);
  const [slot, setSlot] = useState(entry.slot);

  const n = Number(amount) || 0;
  const preview = editableUnits
    ? macrosFor(food, n, unit)
    : (() => {
        const ratio = entry.amount > 0 ? n / entry.amount : 1;
        return { kcal: entry.kcal * ratio, p: entry.p * ratio, c: entry.c * ratio, f: entry.f * ratio };
      })();

  function save() {
    if (n !== entry.amount || unit !== entry.unit) updateEntry(dateKey, entry.id, n, unit);
    if (slot !== entry.slot) moveEntry(dateKey, entry.id, slot);
    onClose();
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />

        <div className="sheet-h">
          {food ? <FoodAvatar food={food} /> : null}
          <h3 className="h4 grow" style={{ margin: 0 }}>{entry.name}</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <input
            className="input num grow" type="number" inputMode="decimal" min="0" step="any"
            value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount" autoFocus
          />
          {editableUnits ? (
            <select
              className="input grow" value={unit} aria-label="Unit"
              onChange={e => {
                setUnit(e.target.value);
                setAmount(e.target.value === "g" ? 100 : 1);
              }}
            >
              {editableUnits.map(u => (
                <option key={u.label} value={u.label}>{u.label}{u.g !== 1 ? ` (${u.g} g)` : ""}</option>
              ))}
            </select>
          ) : (
            <span className="input grow dim" style={{ display: "flex", alignItems: "center" }}>{unit}</span>
          )}
        </div>

        <div className="grid-auto" style={{ marginTop: 16, gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {[["kcal", r0(preview.kcal)], ["Prot", r1(preview.p) + "g"], ["Carb", r1(preview.c) + "g"], ["Fat", r1(preview.f) + "g"]].map(([l, v]) => (
            <div className="nested" style={{ textAlign: "center" }} key={l}>
              <div className="caps faint" style={{ fontSize: 10 }}>{l}</div>
              <div className="stat-sm" style={{ marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>

        <label className="field" style={{ marginTop: 18 }}>
          <span className="lab"><ArrowRightLeft size={11} style={{ verticalAlign: -1, marginRight: 5 }} />Which meal</span>
          <select className="input" value={slot} onChange={e => setSlot(e.target.value)}>
            {slots.map(sl => <option key={sl.id} value={sl.id}>{sl.name} · {sl.time}</option>)}
          </select>
        </label>

        {!editableUnits && (
          <p className="note" style={{ marginBottom: 16 }}>
            This was logged as a one-off, so its macros scale with the amount rather than being
            looked up again.
          </p>
        )}

        <div className="row" style={{ gap: 10, marginTop: 4 }}>
          <button className="btn btn-primary grow" disabled={!(n > 0)} onClick={save}>Save changes</button>
          <button
            className="btn btn-danger" aria-label={`Remove ${entry.name}`}
            onClick={() => { removeEntry(dateKey, entry.id); onClose(); }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
