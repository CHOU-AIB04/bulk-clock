import React, { useState } from "react";
import { X, Calculator } from "lucide-react";
import { useStore, setSetting } from "../lib/store.js";
import { isImperial, plateSet, weightUnit, toDisplayWeight, fromDisplayWeight } from "../lib/units.js";

/** IWF plate colours in kilos; American gyms mostly use grey iron, so pounds get neutrals. */
const PLATE_COLOR = {
  25: "#c8102e", 20: "#0057b8", 15: "#f2c200", 10: "#00843d",
  5: "#e8e8e8", 2.5: "#9a9a9a", 1.25: "#6f6f6f",
  45: "#3b4046", 35: "#4a5057", 10.0: "#5a6068"
};

/**
 * What to hang on the bar for a target load.
 *
 * Greedy from the heaviest plate down, which is both what a person does and
 * always optimal for a standard plate set. If the target cannot be made exactly
 * the closest achievable load is shown instead of silently rounding — being off
 * by 1.25 kg matters when you are chasing a record.
 */
export default function PlateCalculator({ initial = 60, onClose }) {
  useStore(s => s.settings.units);
  const barKg = useStore(s => s.settings.barWeight ?? 20);
  const imperial = isImperial();

  // Everything below works in the DISPLAYED unit, because plates are physical
  // objects: a gym has 20 kg plates or 45 lb plates, never a converted number.
  const unit = weightUnit();
  const bar = imperial ? Math.round(toDisplayWeight(barKg, 0)) : barKg;
  const [target, setTarget] = useState(() => (imperial ? Math.round(toDisplayWeight(initial, 0) / 5) * 5 : initial));

  const barWeight = bar;
  const n = Number(target) || 0;
  const perSide = (n - barWeight) / 2;

  let remaining = perSide;
  const plates = [];
  if (perSide >= 0) {
    for (const p of plateSet()) {
      while (remaining >= p - 0.001) {
        plates.push(p);
        remaining = Math.round((remaining - p) * 1000) / 1000;
      }
    }
  }

  const achieved = barWeight + (perSide - remaining) * 2;
  const exact = Math.abs(achieved - n) < 0.01;

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-h">
          <Calculator size={20} style={{ color: "var(--accent-text)" }} />
          <h3 className="h3 grow" style={{ margin: 0 }}>Plates</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        <div className="grid2">
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="lab">Target load ({unit})</span>
            <input
              className="input num" type="number" inputMode="decimal" step={imperial ? 5 : 2.5} min="0"
              value={target} onChange={e => setTarget(e.target.value)} autoFocus
            />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="lab">Bar ({unit})</span>
            <input
              className="input num" type="number" inputMode="decimal" step={imperial ? 5 : 0.5} min="0"
              value={bar}
              onChange={e => setSetting({ barWeight: imperial ? (fromDisplayWeight(e.target.value) ?? 20) : (Number(e.target.value) || 0) })}
            />
          </label>
        </div>

        {perSide < 0 ? (
          <p className="note warn" style={{ marginTop: 18 }}>
            That's lighter than the bar on its own ({barWeight} {unit}). Use dumbbells or a lighter bar.
          </p>
        ) : (
          <>
            <div className="card" style={{ marginTop: 18 }}>
              <div className="caps faint" style={{ marginBottom: 14 }}>Per side</div>
              <div className="row wrap" style={{ gap: 8 }}>
                {plates.length === 0 && <span className="dim" style={{ fontSize: 14 }}>Just the bar.</span>}
                {plates.map((p, i) => (
                  <span
                    key={i}
                    className="plate"
                    style={{ background: PLATE_COLOR[p] || "var(--surface-highest)", color: p === 5 ? "#111" : "#fff" }}
                  >
                    {p}
                  </span>
                ))}
              </div>
              <div className="dim tnum" style={{ fontSize: 13, marginTop: 14 }}>
                {barWeight} {unit} bar + {plates.length ? plates.join(" + ") : "0"} per side
                {" = "}<b style={{ color: "var(--on-surface)" }}>{achieved} {unit}</b>
              </div>
            </div>

            {!exact && (
              <p className="note warn" style={{ marginTop: 14 }}>
                {n} {unit} can't be made from standard plates. <b>{achieved} {unit}</b> is the closest below it.
              </p>
            )}
          </>
        )}

        <p className="note" style={{ marginTop: 14 }}>
          Assumes a matched pair of every plate and a {barWeight} {unit} bar. Change the bar above if
          yours is a {imperial ? "35 lb women's" : "15 kg women's"} bar or a fixed-weight EZ bar.
        </p>
      </div>
    </div>
  );
}
