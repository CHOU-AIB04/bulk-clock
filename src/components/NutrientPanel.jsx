import React from "react";
import { Info, AlertTriangle } from "lucide-react";
import { useStore, dayNutrients } from "../lib/store.js";
import { NUTRIENT_META, nutrientGoal } from "../data/nutrients.js";

const fmt = (v, unit) => {
  if (v == null) return "—";
  if (unit === "mg" && v >= 1000) return `${(v / 1000).toFixed(1)} g`;
  return v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(0) : v.toFixed(1);
};

/**
 * Everything beyond protein, carbs and fat.
 *
 * The coverage line at the top is the honest part. Composition tables are
 * reliable for whole foods and thin for home-cooked composite dishes, so a day
 * built from tagine and khobz genuinely cannot be assessed for iron. Saying so
 * is better than showing a confident number that is mostly missing data.
 */
export default function NutrientPanel({ dateKey }) {
  useStore(s => s.log);
  const sex = useStore(s => s.profile.sex);
  const { totals, coverage, knownKcal, totalKcal } = dayNutrients(dateKey);

  const good = coverage >= 0.75;
  const partial = coverage >= 0.35 && coverage < 0.75;

  return (
    <div>
      <div className={"note " + (good ? "" : partial ? "warn" : "danger")} style={{ marginBottom: 16 }}>
        {totalKcal === 0 ? (
          <>Nothing logged today yet — nutrients appear as you log food.</>
        ) : good ? (
          <><b>{Math.round(coverage * 100)}% of today's calories</b> came from foods with full
            nutrient data, so the numbers below are a fair picture.</>
        ) : (
          <>
            <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
            <b>Only {Math.round(coverage * 100)}% of today's calories</b> came from foods with nutrient
            data ({Math.round(knownKcal)} of {Math.round(totalKcal)} kcal). Treat everything below as a
            floor, not a total — the real intake is higher.
          </>
        )}
      </div>

      {NUTRIENT_META.map(meta => {
        const value = totals[meta.key];
        const goal = nutrientGoal(meta.key, sex);
        const pct = value == null || !goal ? 0 : Math.min(100, (value / goal) * 100);
        const isLimit = meta.kind === "limit";
        const over = value != null && goal && value > goal;

        const tone = value == null ? "" : isLimit ? (over ? "danger" : "") : pct >= 80 ? "" : pct >= 50 ? "warn" : "danger";

        return (
          <div className="card-sm" key={meta.key} style={{ marginBottom: 10 }}>
            <div className="row" style={{ alignItems: "baseline" }}>
              <span className="h4 grow">{meta.label}</span>
              <span className="stat-sm tnum">
                {fmt(value, meta.unit)}
                <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}>
                  {" "}/ {fmt(goal, meta.unit)} {meta.unit}
                </span>
              </span>
            </div>

            <div className="bar" style={{ marginTop: 10, height: 6 }}>
              <i
                className={tone}
                style={{
                  width: `${pct}%`,
                  background: value == null ? "var(--outline-variant)" : undefined
                }}
              />
            </div>

            <div className="row" style={{ marginTop: 8 }}>
              <span className="caps faint" style={{ fontSize: 9.5 }}>
                {isLimit ? "Upper guideline" : "Daily target"}
              </span>
              <span
                className="caps"
                style={{ marginLeft: "auto", fontSize: 9.5, color: over && isLimit ? "var(--danger)" : "var(--outline)" }}
              >
                {value == null ? "no data" : isLimit ? (over ? "over" : "within") : `${Math.round(pct)}%`}
              </span>
            </div>

            <p className="dim" style={{ fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.5 }}>{meta.note}</p>
          </div>
        );
      })}

      <p className="note" style={{ marginTop: 16 }}>
        <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
        Targets are adult reference intakes, adjusted for sex where they differ. They are population
        averages, not a prescription for you — and a day under target is not a deficiency.
      </p>
    </div>
  );
}
