import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Dumbbell, Scale, X, Utensils } from "lucide-react";
import {
  useStore, todayKey, dkey, parseKey, dayTotals, targetsFor,
  dayConsistency, sessionDoneSets, workoutFor, dayEntries, getState
} from "../lib/store.js";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const r0 = n => Math.round(n);

/**
 * A month at a glance: which days were kept, which had a session, which had a
 * weigh-in. The 30-square grid on this screen hints at this; a real calendar
 * makes a pattern visible — the fortnight that fell apart, the week you nailed.
 */
export default function CalendarView() {
  useStore(s => s.log);
  useStore(s => s.checkins);
  useStore(s => s.lifts);

  const today = parseKey(todayKey());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(null);

  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  // Monday-first grid.
  const lead = (first.getDay() + 6) % 7;
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => dkey(new Date(year, m, i + 1)))
  ];

  const isFuture = key => key > todayKey();

  const monthKeys = cells.filter(Boolean).filter(k => !isFuture(k));
  const kept = monthKeys.filter(k => dayConsistency(k).pct >= 0.8).length;
  const sessions = monthKeys.filter(k => sessionDoneSets(k) > 0).length;

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <button
          className="btn btn-icon btn-quiet" aria-label="Previous month"
          onClick={() => setMonth(new Date(year, m - 1, 1))}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="grow" style={{ textAlign: "center" }}>
          <div className="h4">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
          <div className="caps faint" style={{ marginTop: 3 }}>
            {kept} kept · {sessions} session{sessions === 1 ? "" : "s"}
          </div>
        </div>
        <button
          className="btn btn-icon btn-quiet" aria-label="Next month"
          disabled={year === today.getFullYear() && m === today.getMonth()}
          onClick={() => setMonth(new Date(year, m + 1, 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="cal">
        {DOW.map((d, i) => <span className="cal-dow" key={i}>{d}</span>)}

        {cells.map((key, i) => {
          if (!key) return <span key={`e${i}`} />;
          const day = parseKey(key);
          const future = isFuture(key);
          const c = future ? null : dayConsistency(key);
          const totals = future ? null : dayTotals(key);
          const trained = !future && sessionDoneSets(key) > 0;
          const weighed = !future && hasWeighIn(key);

          const level = future ? "" : c.pct >= 0.8 ? "hit" : c.pct >= 0.4 ? "half" : totals.kcal > 0 ? "some" : "";

          return (
            <button
              key={key}
              className={`cal-day ${level} ${key === todayKey() ? "today" : ""} ${selected === key ? "sel" : ""}`}
              disabled={future}
              aria-label={`${day.toLocaleDateString(undefined, { day: "numeric", month: "long" })}${future ? ", not yet" : `, ${Math.round(c.pct * 100)}% kept`}`}
              onClick={() => setSelected(selected === key ? null : key)}
            >
              <span className="cal-n">{day.getDate()}</span>
              <span className="cal-dots">
                {trained && <i className="t" />}
                {weighed && <i className="w" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="legend" style={{ marginTop: 14 }}>
        <span><i style={{ background: "var(--accent)", width: 10, height: 10, borderRadius: 3 }} />Kept</span>
        <span><i style={{ background: "var(--accent-a40)", width: 10, height: 10, borderRadius: 3 }} />Partial</span>
        <span><i style={{ background: "var(--info)", width: 6, height: 6, borderRadius: 99 }} />Trained</span>
        <span><i style={{ background: "var(--warn)", width: 6, height: 6, borderRadius: 99 }} />Weighed</span>
      </div>

      {selected && <DayDetail dateKey={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/**
 * Read a weigh-in straight from the current snapshot rather than through a hook
 * — this is called once per cell inside a map, and a hook there would be a
 * hook in a loop.
 */
function hasWeighIn(key) {
  return getState().log[key]?.weight != null;
}

function DayDetail({ dateKey, onClose }) {
  const totals = dayTotals(dateKey);
  const targets = targetsFor(dateKey);
  const c = dayConsistency(dateKey);
  const entries = dayEntries(dateKey);
  const wo = workoutFor(dateKey);
  const sets = sessionDoneSets(dateKey);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="grow">
          <span className="h4" style={{ display: "block" }}>
            {parseKey(dateKey).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <span className="dim" style={{ fontSize: 12.5 }}>{Math.round(c.pct * 100)}% of the day kept</span>
        </span>
        <button className="icon-btn" onClick={onClose} aria-label="Close day"><X size={17} /></button>
      </div>

      <div className="grid3">
        <div className="nested">
          <Flame size={15} style={{ color: "var(--accent-text)" }} />
          <div className="caps faint" style={{ fontSize: 9.5, marginTop: 8 }}>Calories</div>
          <div className="stat-sm" style={{ marginTop: 5 }}>{r0(totals.kcal)}</div>
          <div className="dim" style={{ fontSize: 11 }}>of {targets.kcal}</div>
        </div>
        <div className="nested">
          <Utensils size={15} style={{ color: "var(--accent-text)" }} />
          <div className="caps faint" style={{ fontSize: 9.5, marginTop: 8 }}>Meals</div>
          <div className="stat-sm" style={{ marginTop: 5 }}>{c.done}</div>
          <div className="dim" style={{ fontSize: 11 }}>of {c.planned}</div>
        </div>
        <div className="nested">
          <Dumbbell size={15} style={{ color: "var(--accent-text)" }} />
          <div className="caps faint" style={{ fontSize: 9.5, marginTop: 8 }}>Sets</div>
          <div className="stat-sm" style={{ marginTop: 5 }}>{sets}</div>
          <div className="dim" style={{ fontSize: 11 }}>{wo ? wo.name : "rest day"}</div>
        </div>
      </div>

      {entries.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {entries.slice(0, 8).map(e => (
            <div className="entry" key={e.id} style={{ padding: "8px 0" }}>
              <span className="grow dim" style={{ fontSize: 13 }}>
                {e.name} <span className="faint">· {e.amount} {e.unit}</span>
              </span>
              <span className="tnum dim" style={{ fontSize: 12.5 }}>{r0(e.kcal)} kcal</span>
            </div>
          ))}
          {entries.length > 8 && (
            <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>+{entries.length - 8} more</div>
          )}
        </div>
      )}

      {entries.length === 0 && (
        <p className="dim" style={{ fontSize: 13, marginTop: 14, marginBottom: 0 }}>Nothing logged this day.</p>
      )}
    </div>
  );
}
