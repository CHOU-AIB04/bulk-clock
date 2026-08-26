import React, { useMemo, useState } from "react";
import { X, TrendingUp, Trophy, Info } from "lucide-react";
import { historyFor, parseKey } from "../lib/store.js";
import { bestSet, epley, tonnage, muscleOf } from "../lib/lifting.js";

const r1 = n => Math.round(n * 10) / 10;

const METRICS = [
  { id: "e1rm", label: "Est. 1RM", unit: "kg", of: sets => bestSet(sets)?.e1rm || 0 },
  { id: "top", label: "Top set", unit: "kg", of: sets => Math.max(0, ...sets.map(s => s.w || 0)) },
  { id: "volume", label: "Volume", unit: "kg", of: sets => tonnage(sets) }
];

/**
 * One movement, plotted over every session it appears in.
 *
 * Estimated 1RM is the default because it is the only one of the three that
 * moves when you add reps rather than weight — which is what progress looks like
 * for most of a training block.
 */
function Chart({ points, unit }) {
  const W = 320, H = 150, L = 34, R = 8, T = 12, B = 22;
  const iw = W - L - R, ih = H - T - B;

  if (points.length < 2) return null;

  const vals = points.map(p => p.v);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || Math.max(1, hi * 0.05);
  const min = Math.max(0, lo - pad);
  const max = hi + pad;

  const x = i => L + (points.length === 1 ? iw / 2 : (iw * i) / (points.length - 1));
  const y = v => T + ih * (1 - (v - min) / (max - min || 1));

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${T + ih} L${x(0).toFixed(1)} ${T + ih} Z`;

  const ticks = [min, (min + max) / 2, max];
  const last = points[points.length - 1];
  const first = points[0];
  const change = last.v - first.v;

  return (
    <div className="card chart">
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="caps faint grow">{points.length} sessions</span>
        <span className="caps" style={{ color: change >= 0 ? "var(--accent-text)" : "var(--warn)" }}>
          {change >= 0 ? "+" : ""}{r1(change)} {unit}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Progress over ${points.length} sessions`}>
        <defs>
          <linearGradient id="exfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--outline-variant)" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="9" fill="var(--outline)">{Math.round(v)}</text>
          </g>
        ))}

        <path d={area} fill="url(#exfill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.v)} r={i === points.length - 1 ? 4 : 2} fill="var(--accent)" />
        ))}

        <text x={L} y={H - 5} fontSize="9" fill="var(--outline)">
          {parseKey(first.key).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </text>
        <text x={W - R} y={H - 5} textAnchor="end" fontSize="9" fill="var(--outline)">
          {parseKey(last.key).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </text>
      </svg>
    </div>
  );
}

export default function ExerciseHistory({ exercise, onClose }) {
  const [metric, setMetric] = useState("e1rm");
  const history = useMemo(() => historyFor(exercise), [exercise]);
  const meta = METRICS.find(m => m.id === metric);

  const points = history.map(h => ({ key: h.key, v: meta.of(h.sets) })).filter(p => p.v > 0);

  const allSets = history.flatMap(h => h.sets);
  const heaviest = allSets.length ? Math.max(...allSets.map(s => s.w)) : 0;
  const best = bestSet(allSets);

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />

        <div className="sheet-h">
          <TrendingUp size={20} style={{ color: "var(--accent-text)" }} />
          <span className="grow" style={{ minWidth: 0 }}>
            <h3 className="h4" style={{ margin: 0 }}>{exercise}</h3>
            <span className="dim" style={{ fontSize: 12.5 }}>{muscleOf(exercise)}</span>
          </span>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        {history.length === 0 ? (
          <div className="empty">
            <span className="empty-ico"><TrendingUp size={24} /></span>
            No sets logged for this movement yet. Log a session and the chart fills in.
          </div>
        ) : (
          <>
            <div className="grid3" style={{ marginBottom: 16 }}>
              <div className="card-sm" style={{ padding: 13 }}>
                <div className="caps faint" style={{ fontSize: 9.5 }}>Heaviest</div>
                <div className="stat-sm" style={{ marginTop: 6 }}>{heaviest}<span className="dim" style={{ fontSize: 11, fontWeight: 400 }}> kg</span></div>
              </div>
              <div className="card-sm" style={{ padding: 13 }}>
                <div className="caps faint" style={{ fontSize: 9.5 }}>Best e1RM</div>
                <div className="stat-sm" style={{ marginTop: 6 }}>{best ? r1(best.e1rm) : "—"}<span className="dim" style={{ fontSize: 11, fontWeight: 400 }}> kg</span></div>
              </div>
              <div className="card-sm" style={{ padding: 13 }}>
                <div className="caps faint" style={{ fontSize: 9.5 }}>Sessions</div>
                <div className="stat-sm" style={{ marginTop: 6 }}>{history.length}</div>
              </div>
            </div>

            <div className="seg" style={{ marginBottom: 14 }}>
              {METRICS.map(m => (
                <button key={m.id} aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}>{m.label}</button>
              ))}
            </div>

            {points.length >= 2
              ? <Chart points={points} unit={meta.unit} />
              : <p className="note">Two sessions are needed before there's a line to draw. One more and this fills in.</p>}

            <div className="sect-h" style={{ marginTop: 24 }}>
              <h2 className="h4">Every session</h2>
              <span className="caps faint">newest first</span>
            </div>

            {[...history].reverse().map(h => {
              const b = bestSet(h.sets);
              return (
                <div className="entry" key={h.key}>
                  <span className="grow" style={{ fontSize: 14 }}>
                    {parseKey(h.key).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                    <span className="dim" style={{ display: "block", fontSize: 12, marginTop: 2 }}>
                      {h.sets.map(s => `${s.w}×${s.r}${s.rpe ? ` @${s.rpe}` : ""}`).join("  ")}
                    </span>
                  </span>
                  <span className="tnum dim" style={{ fontSize: 12.5, textAlign: "right" }}>
                    {Math.round(tonnage(h.sets)).toLocaleString()} kg
                    {b ? <span style={{ display: "block", color: "var(--accent-text)" }}>e1RM {r1(b.e1rm)}</span> : null}
                  </span>
                </div>
              );
            })}

            <p className="note" style={{ marginTop: 16 }}>
              <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              <b>Estimated 1RM</b> uses the Epley formula and is only calculated from sets of 12 reps
              or fewer, where it holds to within a few percent. It is an estimate, not an instruction
              to go and test it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
