import React, { useState } from "react";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import { mealMacros, mealServingMacros, mealServings, foodMap } from "../lib/store.js";
import { MealAvatar } from "./FoodAvatar.jsx";

const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;

/** Common fractions of a portion, so "half a plate" is one tap not a keyboard. */
const STEPS = [0.5, 1, 1.5, 2, 3];

/**
 * How much of a recipe you actually ate.
 *
 * A recipe declares how many servings it makes; this picks how many of those
 * servings went on your plate. Both numbers are shown, because "1 serving of a
 * recipe that makes 4" is the bit people get wrong.
 */
export default function MealPortion({ meal, onDone, onBack, ctaLabel = "Add to log" }) {
  const [portions, setPortions] = useState(1);
  const fmap = foodMap();

  const makes = mealServings(meal);
  const per = mealServingMacros(meal);
  const whole = mealMacros(meal);
  const n = Number(portions) || 0;

  return (
    <>
      <div className="sheet-h">
        <button className="btn-ghost" onClick={onBack} aria-label="Back"><ChevronLeft size={22} /></button>
        <MealAvatar meal={meal} foodById={fmap} />
        <h3 className="h4 grow" style={{ margin: 0 }}>{meal.name}</h3>
      </div>

      <p className="note" style={{ marginBottom: 16 }}>
        This recipe makes <b>{makes} serving{makes === 1 ? "" : "s"}</b> — {r0(whole.kcal)} kcal in
        total, {r0(per.kcal)} kcal each.
      </p>

      <div className="row" style={{ gap: 10 }}>
        <button
          className="btn btn-icon btn-quiet" aria-label="Less"
          disabled={n <= 0.25} onClick={() => setPortions(Math.max(0.25, Math.round((n - 0.25) * 100) / 100))}
        >
          <Minus size={18} />
        </button>
        <input
          className="input num grow" type="number" inputMode="decimal" min="0" step="0.25"
          style={{ textAlign: "center", fontSize: 24 }}
          value={portions} onChange={e => setPortions(e.target.value)} aria-label="Servings eaten"
        />
        <button
          className="btn btn-icon btn-quiet" aria-label="More"
          onClick={() => setPortions(Math.round((n + 0.25) * 100) / 100)}
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="chips" style={{ marginTop: 12 }}>
        {STEPS.map(v => (
          <button key={v} className="chip" aria-pressed={n === v} onClick={() => setPortions(v)}>
            {v === 0.5 ? "Half" : v === 1 ? "1 serving" : `${v}`}
          </button>
        ))}
        {makes > 1 && (
          <button className="chip" aria-pressed={n === makes} onClick={() => setPortions(makes)}>
            All {makes}
          </button>
        )}
      </div>

      <div className="grid-auto" style={{ marginTop: 18, gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {[
          ["kcal", r0(per.kcal * n)],
          ["Prot", r1(per.p * n) + "g"],
          ["Carb", r1(per.c * n) + "g"],
          ["Fat", r1(per.f * n) + "g"]
        ].map(([l, v]) => (
          <div className="nested" style={{ textAlign: "center" }} key={l}>
            <div className="caps faint" style={{ fontSize: 10 }}>{l}</div>
            <div className="stat-sm" style={{ marginTop: 6 }}>{v}</div>
          </div>
        ))}
      </div>

      <button
        className="btn btn-primary btn-wide" style={{ marginTop: 20 }}
        disabled={!(n > 0)} onClick={() => onDone(meal, n)}
      >
        {ctaLabel}
      </button>
    </>
  );
}
