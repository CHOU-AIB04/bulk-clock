import React, { useMemo, useState } from "react";
import { Search, X, Utensils, Dumbbell, CalendarDays } from "lucide-react";
import { useStore, parseKey, todayKey, dayTotals } from "../lib/store.js";
import { tonnage, bestSet } from "../lib/lifting.js";

const r0 = n => Math.round(n);
const fold = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const longDate = k => parseKey(k).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/**
 * "When did I last eat this?" — a question the app held the answer to and had no
 * way to ask.
 *
 * Searches food entries and logged movements together, newest first, because
 * the useful answer is almost always the most recent one.
 */
export default function HistorySearch() {
  const state = useStore();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");

  const results = useMemo(() => {
    const needle = fold(q.trim());
    if (needle.length < 2) return null;

    const food = [];
    const lifts = [];

    if (scope !== "training") {
      for (const [key, day] of Object.entries(state.log)) {
        for (const e of day.entries || []) {
          if (fold(e.name).includes(needle)) food.push({ key, entry: e });
        }
      }
      food.sort((a, b) => (a.key < b.key ? 1 : -1));
    }

    if (scope !== "food") {
      for (const [key, day] of Object.entries(state.lifts)) {
        for (const [name, rec] of Object.entries(day.ex || {})) {
          if (!fold(name).includes(needle)) continue;
          const sets = (rec.sets || []).filter(s => s.w != null && s.r != null);
          if (sets.length) lifts.push({ key, name, sets });
        }
      }
      lifts.sort((a, b) => (a.key < b.key ? 1 : -1));
    }

    return { food, lifts };
  }, [q, scope, state.log, state.lifts]);

  const totalTimes = results ? results.food.length : 0;
  const totalKcal = results ? results.food.reduce((n, f) => n + f.entry.kcal, 0) : 0;

  return (
    <div>
      <div className="search-wrap">
        <Search size={20} />
        <input
          className="input" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search everything you've logged…"
          aria-label="Search your history"
        />
        {q && (
          <button
            className="icon-btn" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}
            onClick={() => setQ("")} aria-label="Clear search"
          >
            <X size={17} />
          </button>
        )}
      </div>

      <div className="chips" style={{ marginTop: 12 }}>
        {[["all", "Everything"], ["food", "Food"], ["training", "Training"]].map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={scope === k} onClick={() => setScope(k)}>{l}</button>
        ))}
      </div>

      {!results && (
        <p className="note" style={{ marginTop: 16 }}>
          Type at least two letters. Searches every food you've logged and every movement you've
          trained, across your whole history.
        </p>
      )}

      {results && results.food.length === 0 && results.lifts.length === 0 && (
        <div className="empty">
          <span className="empty-ico"><Search size={24} /></span>
          Nothing in your log matches “{q}”.
        </div>
      )}

      {results && results.food.length > 0 && (
        <>
          <div className="sect-h" style={{ marginTop: 22 }}>
            <h2 className="h4"><Utensils size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Food</h2>
            <span className="caps faint">{totalTimes}× · {r0(totalKcal).toLocaleString()} kcal total</span>
          </div>

          <p className="note" style={{ marginBottom: 14 }}>
            Last eaten <b>{longDate(results.food[0].key)}</b>
            {results.food.length > 1 && <>, {results.food.length} times in total</>}.
          </p>

          {results.food.slice(0, 40).map(({ key, entry }) => (
            <div className="entry" key={entry.id}>
              <span className="grow" style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14, display: "block" }}>{entry.name}</span>
                <span className="dim" style={{ fontSize: 12, display: "block", marginTop: 2 }}>
                  {longDate(key)} · {entry.amount} {entry.unit}
                </span>
              </span>
              <span className="tnum dim" style={{ fontSize: 12.5, textAlign: "right" }}>
                {r0(entry.kcal)} kcal
                <span style={{ display: "block", color: "var(--accent-text)" }}>{r0(entry.p)} g P</span>
              </span>
            </div>
          ))}
          {results.food.length > 40 && (
            <p className="dim" style={{ fontSize: 12.5, marginTop: 10 }}>
              Showing the 40 most recent of {results.food.length}.
            </p>
          )}
        </>
      )}

      {results && results.lifts.length > 0 && (
        <>
          <div className="sect-h" style={{ marginTop: 26 }}>
            <h2 className="h4"><Dumbbell size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Training</h2>
            <span className="caps faint">{results.lifts.length} session{results.lifts.length === 1 ? "" : "s"}</span>
          </div>

          {results.lifts.slice(0, 25).map((h, i) => {
            const b = bestSet(h.sets);
            return (
              <div className="entry" key={h.key + h.name + i}>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14, display: "block" }}>{h.name}</span>
                  <span className="dim" style={{ fontSize: 12, display: "block", marginTop: 2 }}>
                    {longDate(h.key)} · {h.sets.map(s => `${s.w}×${s.r}`).join("  ")}
                  </span>
                </span>
                <span className="tnum dim" style={{ fontSize: 12.5, textAlign: "right" }}>
                  {Math.round(tonnage(h.sets)).toLocaleString()} kg
                  {b && <span style={{ display: "block", color: "var(--accent-text)" }}>e1RM {Math.round(b.e1rm * 10) / 10}</span>}
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
