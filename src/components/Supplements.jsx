import React, { useState } from "react";
import { Pill, Plus, Trash2, Check, X, Clock, Info } from "lucide-react";
import {
  useStore, todayKey, SUPPLEMENT_PRESETS, addSupplement, updateSupplement,
  deleteSupplement, supplementsFor, supplementTaken, toggleSupplement, supplementStreak
} from "../lib/store.js";
import { tapLight } from "../lib/haptics.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Supplements, kept out of the food log on purpose.
 *
 * 5 g of creatine is not a meal and does not belong in a calorie total, and
 * burying it among the food is exactly why people forget it. Its own checklist,
 * its own times, its own reminders.
 */
export default function Supplements({ dateKey = todayKey() }) {
  const all = useStore(s => s.supplements);
  useStore(s => s.supplementLog);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const due = supplementsFor(dateKey);
  const taken = due.filter(s => supplementTaken(dateKey, s.id)).length;
  const streak = supplementStreak(30);

  return (
    <div>
      {all.length > 0 && (
        <div className="card-sm" style={{ marginBottom: 14 }}>
          <div className="row">
            <Pill size={19} style={{ color: "var(--accent-text)" }} />
            <span className="grow">
              <span className="caps faint" style={{ display: "block", fontSize: 10 }}>Taken today</span>
              <span className="stat-sm" style={{ display: "block", marginTop: 5 }}>
                {taken}<span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> / {due.length}</span>
              </span>
            </span>
            {streak.seen > 0 && (
              <span className="badge">{Math.round(streak.pct * 100)}% · 30 days</span>
            )}
          </div>
        </div>
      )}

      {due.length === 0 && all.length === 0 && (
        <div className="empty">
          <span className="empty-ico"><Pill size={24} /></span>
          Nothing here yet. Add what you actually take — creatine and vitamin D are the two with
          real evidence behind them for most lifters.
        </div>
      )}

      {due.map(sup => {
        const done = supplementTaken(dateKey, sup.id);
        return (
          <div className="checkrow" data-state={done ? "yes" : ""} key={sup.id}>
            <button
              className="tick" aria-pressed={done}
              aria-label={`Mark ${sup.name} ${done ? "not taken" : "taken"}`}
              onClick={() => { tapLight(); toggleSupplement(dateKey, sup.id); }}
              style={{ background: done ? "var(--accent)" : undefined, borderColor: done ? "var(--accent)" : undefined, color: done ? "var(--on-accent)" : "transparent" }}
            >
              <Check size={17} strokeWidth={3} />
            </button>
            <button className="grow" style={{ textAlign: "left", minWidth: 0 }} onClick={() => setEditing(sup)}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{sup.name}</span>
              <span className="dim" style={{ display: "block", fontSize: 12, marginTop: 2 }}>
                {sup.dose ? `${sup.dose} ${sup.unit} · ` : ""}{sup.time}
                {sup.days ? ` · ${sup.days.map(d => DAYS[d - 1]).join(", ")}` : ""}
              </span>
            </button>
            <button className="icon-btn" aria-label={`Remove ${sup.name}`} onClick={() => deleteSupplement(sup.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}

      {all.length > due.length && (
        <p className="dim" style={{ fontSize: 12.5, marginTop: 10 }}>
          {all.length - due.length} more not scheduled for today.
        </p>
      )}

      <button className="btn btn-secondary btn-wide" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
        <Plus size={17} /> Add a supplement
      </button>

      <p className="note" style={{ marginTop: 14 }}>
        <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
        Supplements are not counted in your calories or macros — if you drink a protein shake, log
        the whey as food as well. This list is about remembering to take things, not measuring them.
      </p>

      {(adding || editing) && (
        <SupplementSheet
          existing={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function SupplementSheet({ existing, onClose }) {
  const [v, setV] = useState(() => ({
    name: existing?.name || "",
    dose: existing?.dose ?? "",
    unit: existing?.unit || "g",
    time: existing?.time || "09:00",
    days: existing?.days || null,
    note: existing?.note || ""
  }));

  const set = patch => setV({ ...v, ...patch });
  const ok = v.name.trim().length > 0;

  function toggleDay(d) {
    const cur = v.days || [1, 2, 3, 4, 5, 6, 7];
    const next = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d].sort();
    set({ days: next.length === 7 ? null : next.length ? next : null });
  }

  function save() {
    const payload = {
      name: v.name.trim(),
      dose: v.dose === "" ? null : Number(v.dose),
      unit: v.unit,
      time: v.time,
      days: v.days,
      note: v.note
    };
    if (existing) updateSupplement(existing.id, payload);
    else addSupplement(payload);
    onClose();
  }

  const active = v.days || [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-h">
          <Pill size={20} style={{ color: "var(--accent-text)" }} />
          <h3 className="h3 grow" style={{ margin: 0 }}>{existing ? "Edit supplement" : "New supplement"}</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        {!existing && (
          <>
            <div className="caps faint" style={{ marginBottom: 10 }}>Common ones</div>
            <div className="chips scroll-x" style={{ marginBottom: 18 }}>
              {SUPPLEMENT_PRESETS.map(p => (
                <button
                  key={p.name} className="chip"
                  onClick={() => set({ name: p.name, dose: p.dose, unit: p.unit, note: p.note })}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="field">
          <span className="lab">Name</span>
          <input className="input" value={v.name} onChange={e => set({ name: e.target.value })} placeholder="Creatine monohydrate" autoFocus />
        </label>

        <div className="row" style={{ gap: 10, marginBottom: 16 }}>
          <label className="field grow" style={{ marginBottom: 0 }}>
            <span className="lab">Dose</span>
            <input
              className="input num" inputMode="decimal" value={v.dose}
              onChange={e => set({ dose: e.target.value })} placeholder="5"
            />
          </label>
          <label className="field grow" style={{ marginBottom: 0 }}>
            <span className="lab">Unit</span>
            <select className="input" value={v.unit} onChange={e => set({ unit: e.target.value })}>
              {["g", "mg", "IU", "ml", "tablet", "capsule", "scoop"].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="field" style={{ marginBottom: 0, flex: "0 0 118px" }}>
            <span className="lab">Time</span>
            <input className="input num" type="time" value={v.time} onChange={e => set({ time: e.target.value })} />
          </label>
        </div>

        <span className="lab"><Clock size={11} style={{ verticalAlign: -1, marginRight: 5 }} />Which days</span>
        <div className="chips" style={{ marginTop: 8, marginBottom: 16 }}>
          {DAYS.map((d, i) => (
            <button
              key={d} className="chip" aria-pressed={active.includes(i + 1)}
              onClick={() => toggleDay(i + 1)}
            >
              {d}
            </button>
          ))}
        </div>

        {v.note && <p className="note" style={{ marginBottom: 16 }}>{v.note}</p>}

        <button className="btn btn-primary btn-wide" disabled={!ok} onClick={save}>
          {existing ? "Save changes" : "Add it"}
        </button>
      </div>
    </div>
  );
}
