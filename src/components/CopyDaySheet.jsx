import React, { useState } from "react";
import { X, CalendarDays, Copy, Check, AlertTriangle } from "lucide-react";
import {
  useStore, todayKey, addDays, parseKey, dayEntries, dayTotals,
  copyDay, copySlot
} from "../lib/store.js";

const r0 = n => Math.round(n);

/**
 * Bulking diets repeat by design — the same four meals, most days. Retyping them
 * every morning is the single most tedious thing a tracker asks of you, so a day
 * or a single meal can be lifted wholesale from any of the last three weeks.
 *
 * Copies are independent from the moment they land: new ids, editable, and
 * nothing links back to the day they came from.
 */
export default function CopyDaySheet({ dateKey, slot = null, onClose, onDone }) {
  const slots = useStore(s => s.profile.slots);
  useStore(s => s.log);
  const [replace, setReplace] = useState(false);
  const [done, setDone] = useState(null);

  // The last 21 days that actually have something logged, newest first.
  const candidates = [];
  for (let i = 1; i <= 21 && candidates.length < 12; i++) {
    const key = addDays(dateKey, -i);
    const entries = dayEntries(key);
    const relevant = slot ? entries.filter(e => e.slot === slot.id) : entries;
    if (relevant.length) candidates.push({ key, entries: relevant });
  }

  const existing = slot
    ? dayEntries(dateKey).filter(e => e.slot === slot.id).length
    : dayEntries(dateKey).length;

  function apply(fromKey) {
    const n = slot
      ? copySlot(fromKey, slot.id, dateKey, slot.id)
      : copyDay(fromKey, dateKey, { replace });
    setDone(n);
    setTimeout(() => { onDone?.(n); onClose(); }, 550);
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />

        <div className="sheet-h">
          <h3 className="h3 grow" style={{ margin: 0 }}>
            {slot ? `Copy ${slot.name}` : "Copy a day"}
          </h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        {done != null ? (
          <div className="empty">
            <span className="empty-ico" style={{ background: "var(--accent-a20)", color: "var(--accent-text)" }}>
              <Check size={24} />
            </span>
            <b style={{ color: "var(--on-surface)" }}>{done} item{done === 1 ? "" : "s"} copied.</b>
          </div>
        ) : (
          <>
            <p className="note" style={{ marginBottom: 16 }}>
              {slot
                ? <>Pick a day and its <b>{slot.name}</b> lands here as a fresh copy you can edit.</>
                : <>Pick a day and everything logged on it is copied onto <b>{parseKey(dateKey).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</b>.</>}
            </p>

            {!slot && existing > 0 && (
              <div className="card-sm" style={{ marginBottom: 16 }}>
                <div className="toggle" style={{ padding: 0, borderBottom: "none" }}>
                  <div className="grow">
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Replace what's here</div>
                    <div className="dim" style={{ fontSize: 12.5, marginTop: 3 }}>
                      {replace
                        ? `The ${existing} item${existing === 1 ? "" : "s"} already logged today will be removed first`
                        : `The copy is added alongside the ${existing} item${existing === 1 ? "" : "s"} already logged`}
                    </div>
                  </div>
                  <button
                    className="sw" role="switch" aria-checked={replace} aria-label="Replace what's already logged"
                    onClick={() => setReplace(v => !v)}
                  ><i /></button>
                </div>
              </div>
            )}

            {replace && (
              <p className="note danger" style={{ marginBottom: 16 }}>
                <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                This clears today's log before copying. There is no undo.
              </p>
            )}

            {candidates.length === 0 && (
              <div className="empty">
                <span className="empty-ico"><CalendarDays size={24} /></span>
                Nothing logged in the last three weeks to copy from yet.
              </div>
            )}

            {candidates.map(({ key, entries }) => {
              const d = parseKey(key);
              const totals = entries.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p }), { kcal: 0, p: 0 });
              const bySlot = slot ? null : slots.filter(sl => entries.some(e => e.slot === sl.id)).length;
              return (
                <button key={key} className="list-row" onClick={() => apply(key)}>
                  <span className="ico"><Copy size={19} /></span>
                  <span className="grow">
                    <span className="t">
                      {key === addDays(todayKey(), -1) ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
                    </span>
                    <span className="d" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {slot
                        ? entries.map(e => e.name).join(", ")
                        : `${entries.length} items across ${bySlot} meal${bySlot === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  <span className="v">
                    <span className="stat-sm">{r0(totals.kcal)}</span>
                    <span className="d neon">{r0(totals.p)} g P</span>
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
