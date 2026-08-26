import React from "react";
import { Droplets, Minus, Plus, RotateCcw } from "lucide-react";
import { useStore, dayWater, addWater, setWater } from "../lib/store.js";

/**
 * Water, counted in glasses rather than millilitres, because nobody measures.
 * The glass size is configurable for people who drink from a 1.5 L bottle.
 */
export default function WaterCard({ dateKey }) {
  useStore(s => s.log);
  const target = useStore(s => s.settings.waterTargetMl);
  const glass = useStore(s => s.settings.waterGlassMl) || 250;

  const ml = dayWater(dateKey);
  const glasses = Math.ceil(target / glass);
  const full = Math.floor(ml / glass);
  const partial = ml - full * glass > 0;
  const pct = target ? Math.min(100, (ml / target) * 100) : 0;

  return (
    <div className="card-sm">
      <div className="row">
        <Droplets size={19} style={{ color: "var(--info)" }} />
        <span className="grow">
          <span className="caps faint" style={{ display: "block", fontSize: 10 }}>Water</span>
          <span className="stat-sm" style={{ display: "block", marginTop: 5 }}>
            {(ml / 1000).toFixed(1)}
            <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> / {(target / 1000).toFixed(1)} L</span>
          </span>
        </span>
        <button
          className="btn btn-icon btn-quiet" aria-label="Remove a glass"
          disabled={ml <= 0} onClick={() => addWater(dateKey, -glass)}
        >
          <Minus size={18} />
        </button>
        <button className="btn btn-icon btn-primary" aria-label="Add a glass" onClick={() => addWater(dateKey, glass)}>
          <Plus size={18} />
        </button>
      </div>

      <div className="glasses" aria-hidden="true">
        {Array.from({ length: Math.min(20, glasses) }, (_, i) => (
          <i key={i} className={i < full ? "full" : i === full && partial ? "part" : ""} />
        ))}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <span className="dim" style={{ fontSize: 12 }}>
          {ml >= target
            ? "Target reached"
            : `${Math.ceil((target - ml) / glass)} more glass${Math.ceil((target - ml) / glass) === 1 ? "" : "es"} · ${glass} ml each`}
        </span>
        {ml > 0 && (
          <button
            className="icon-btn" style={{ marginLeft: "auto" }}
            aria-label="Reset today's water" onClick={() => setWater(dateKey, 0)}
          >
            <RotateCcw size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
