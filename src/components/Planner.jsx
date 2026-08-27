import React, { useState } from "react";
import {
  X, ChevronLeft, ChevronRight, Plus, Trash2, CalendarClock, Check,
  Copy, ShoppingCart, Info
} from "lucide-react";
import {
  useStore, todayKey, addDays, parseKey, targetsFor,
  planFor, planForSlot, addToPlan, removeFromPlan, clearPlan, copyPlan,
  planTotals, planItemMacros, planItemName, logPlanned, dayEntries
} from "../lib/store.js";
import AddSheet from "./AddSheet.jsx";
import ShoppingList from "./ShoppingList.jsx";

const r0 = n => Math.round(n);
const longDate = k => parseKey(k).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

/**
 * Deciding what you'll eat before you're hungry.
 *
 * A plan is intent, not history — nothing here counts toward a day's totals
 * until it's logged, which is one deliberate tap. That separation is what keeps
 * the consistency figure meaning something: a planned week you didn't eat should
 * not look like a week you did.
 */
export default function Planner({ onClose }) {
  const slots = useStore(s => s.profile.slots);
  useStore(s => s.plan);
  const [dateKey, setDateKey] = useState(() => addDays(todayKey(), 1));
  const [adding, setAdding] = useState(null);
  const [shopping, setShopping] = useState(false);

  const plan = planFor(dateKey);
  const totals = planTotals(dateKey);
  const targets = targetsFor(dateKey);
  const planned = Object.values(plan).flat().length;
  const alreadyLogged = dayEntries(dateKey).length;
  const isPast = dateKey < todayKey();

  const pct = targets.kcal ? Math.min(100, (totals.kcal / targets.kcal) * 100) : 0;
  const gap = Math.round(targets.kcal - totals.kcal);

  if (shopping) {
    return <ShoppingList fromKey={dateKey} onClose={() => setShopping(false)} />;
  }

  if (adding) {
    return (
      <AddSheet
        dateKey={dateKey}
        slot={adding}
        mode="plan"
        onPlan={item => addToPlan(dateKey, adding.id, item)}
        onClose={() => setAdding(null)}
      />
    );
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />

        <div className="sheet-h">
          <CalendarClock size={20} style={{ color: "var(--accent-text)" }} />
          <h3 className="h3 grow" style={{ margin: 0 }}>Plan ahead</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        <div className="row" style={{ marginBottom: 14 }}>
          <button className="btn btn-icon btn-quiet" onClick={() => setDateKey(addDays(dateKey, -1))} aria-label="Previous day">
            <ChevronLeft size={18} />
          </button>
          <div className="grow" style={{ textAlign: "center" }}>
            <div className="h4">{dateKey === todayKey() ? "Today" : longDate(dateKey)}</div>
            <div className="caps faint" style={{ marginTop: 3 }}>
              {planned ? `${planned} item${planned === 1 ? "" : "s"} planned` : "nothing planned"}
            </div>
          </div>
          <button className="btn btn-icon btn-quiet" onClick={() => setDateKey(addDays(dateKey, 1))} aria-label="Next day">
            <ChevronRight size={18} />
          </button>
        </div>

        {planned > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row">
              <span className="grow">
                <span className="caps faint" style={{ display: "block", fontSize: 10 }}>Planned intake</span>
                <span className="stat-sm" style={{ display: "block", marginTop: 6 }}>
                  {r0(totals.kcal)}
                  <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> / {targets.kcal} kcal</span>
                </span>
              </span>
              <span className="v" style={{ textAlign: "right" }}>
                <span className="stat-sm tnum neon">{r0(totals.p)} g</span>
                <span className="d">protein of {targets.p}</span>
              </span>
            </div>
            <div className="bar" style={{ marginTop: 12 }}>
              <i className={pct > 105 ? "warn" : ""} style={{ width: `${pct}%` }} />
            </div>
            <p className="dim" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
              {Math.abs(gap) < 100
                ? "That lands on target. Nothing to adjust."
                : gap > 0
                  ? `${gap} kcal short of the day's target — add something, or accept a lighter day.`
                  : `${Math.abs(gap)} kcal over. Fine occasionally; the weekly total is what counts.`}
            </p>
          </div>
        )}

        {slots.map(slot => {
          const items = planForSlot(dateKey, slot.id);
          return (
            <div className="card-sm" key={slot.id} style={{ marginBottom: 10 }}>
              <div className="row">
                <span className="grow">
                  <span className="h4" style={{ display: "block" }}>{slot.name}</span>
                  <span className="dim" style={{ fontSize: 12 }}>{slot.time}</span>
                </span>
                <button className="btn btn-sm btn-quiet" onClick={() => setAdding(slot)}>
                  <Plus size={14} /> Add
                </button>
              </div>

              {items.map(item => {
                const m = planItemMacros(item);
                return (
                  <div className="entry" key={item.id} style={{ padding: "9px 0" }}>
                    <span className="grow" style={{ fontSize: 13.5, minWidth: 0 }}>
                      {planItemName(item)}
                      <span className="dim" style={{ display: "block", fontSize: 11.5, marginTop: 2 }}>
                        {item.amount} {item.unit}
                      </span>
                    </span>
                    <span className="tnum dim" style={{ fontSize: 12.5 }}>{r0(m.kcal)} kcal</span>
                    <button
                      className="icon-btn" aria-label={`Remove ${planItemName(item)} from the plan`}
                      onClick={() => removeFromPlan(dateKey, slot.id, item.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}

              {items.length === 0 && (
                <p className="dim" style={{ fontSize: 12.5, margin: "10px 0 0" }}>Nothing planned.</p>
              )}
            </div>
          );
        })}

        {planned > 0 && (
          <>
            <button
              className="btn btn-primary btn-wide" style={{ marginTop: 14 }}
              onClick={() => { logPlanned(dateKey); }}
              disabled={isPast}
            >
              <Check size={17} /> Log the whole day as planned
            </button>
            {alreadyLogged > 0 && (
              <p className="note warn" style={{ marginTop: 10 }}>
                {alreadyLogged} item{alreadyLogged === 1 ? " is" : "s are"} already logged for this
                day. Logging the plan adds to them rather than replacing them.
              </p>
            )}

            <div className="row" style={{ gap: 10, marginTop: 10 }}>
              <button className="btn btn-quiet grow" onClick={() => copyPlan(dateKey, addDays(dateKey, 1))}>
                <Copy size={16} /> Copy to tomorrow
              </button>
              <button className="btn btn-quiet" onClick={() => clearPlan(dateKey)} aria-label="Clear this day's plan">
                <Trash2 size={16} />
              </button>
            </div>
          </>
        )}

        <button className="btn btn-secondary btn-wide" style={{ marginTop: 14 }} onClick={() => setShopping(true)}>
          <ShoppingCart size={17} /> Shopping list from here
        </button>

        <p className="note" style={{ marginTop: 14 }}>
          <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          A plan is intent, not history. Nothing counts toward a day's totals until you log it, so a
          week you planned and didn't eat never looks like a week you did.
        </p>
      </div>
    </div>
  );
}
