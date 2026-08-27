import React, { useMemo, useState } from "react";
import {
  Search, Plus, X, Trash2, Pencil, BookOpen, Sparkles, Download, Info,
  MoreVertical, Copy, AlertTriangle
} from "lucide-react";
import { CATEGORIES, macrosFor } from "../data/foods.js";
import {
  useStore, mealMacros, mealServingMacros, mealServings, saveMeal, deleteMeal,
  duplicateMeal, newMealId, dayTotals, todayKey, foodMap, allFoods,
  loadStarterMeals, deleteCustomFood, targetsFor
} from "../lib/store.js";
import { Portion, FoodList, FoodEditor } from "../components/AddSheet.jsx";
import FoodAvatar, { MealAvatar } from "../components/FoodAvatar.jsx";
import { PhotoPicker, Photo } from "../components/Photo.jsx";
import NutrientPanel from "../components/NutrientPanel.jsx";
import Supplements from "../components/Supplements.jsx";
import FastingCard from "../components/FastingCard.jsx";
import { NUTRIENT_META } from "../data/nutrients.js";
import { nutrientsForGrams } from "../data/nutrients.js";
import Ring from "../components/Ring.jsx";
import { t } from "../lib/i18n.js";

const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;

/* ── meal builder ─────────────────────────────────────── */

function Builder({ meal, onClose }) {
  const [name, setName] = useState(meal.name);
  const [photo, setPhoto] = useState(meal.photo || null);
  const [servings, setServings] = useState(mealServings(meal));
  const [items, setItems] = useState(meal.items);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [picking, setPicking] = useState(null);
  const [creating, setCreating] = useState(null);

  const fmap = foodMap();
  const totals = useMemo(() => mealMacros({ items }), [items, fmap]);
  const servingCount = Number(servings) > 0 ? Number(servings) : 1;
  const perServing = {
    kcal: totals.kcal / servingCount, p: totals.p / servingCount,
    c: totals.c / servingCount, f: totals.f / servingCount
  };

  const wrap = inner => (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />
        {inner}
      </div>
    </div>
  );

  if (picking) {
    return wrap(
      <Portion
        food={picking} onBack={() => setPicking(null)} ctaLabel="Add ingredient"
        onDone={(food, amount, unit) => {
          setItems([...items, { foodId: food.id, amount, unit }]);
          setPicking(null);
          setQ("");
        }}
      />
    );
  }

  if (creating !== null) {
    return wrap(
      <FoodEditor
        initialName={creating}
        onCancel={() => setCreating(null)}
        onDone={food => { setCreating(null); setPicking(food); }}
      />
    );
  }

  return wrap(
    <>
      <div className="sheet-h">
        <h3 className="h3">{meal.existing ? "Edit meal" : "New meal"}</h3>
        <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
      </div>

      <label className="field">
        <span className="lab">Meal name</span>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Rice plate — chicken" autoFocus={!meal.existing} />
      </label>

      <div className="field">
        <span className="lab">Photo</span>
        <PhotoPicker
          id={photo} onChange={setPhoto} size="meal"
          label="Add a photo" replaceLabel="Change photo"
        />
      </div>

      <label className="field">
        <span className="lab">How many servings does this make</span>
        <div className="row" style={{ gap: 10 }}>
          <input
            className="input num grow" type="number" inputMode="decimal" min="0.5" step="0.5"
            value={servings} onChange={e => setServings(e.target.value)} aria-label="Servings"
          />
          <div className="chips">
            {[1, 2, 4].map(v => (
              <button key={v} className="chip" aria-pressed={Number(servings) === v} onClick={() => setServings(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </label>
      <p className="note" style={{ marginBottom: 18 }}>
        Build the recipe at the size you actually cook it, then say how many portions that is.
        Logging one serving takes a {servingCount > 1 ? `${servingCount}th` : "single"} of these numbers.
      </p>

      <div className="glass" style={{ marginBottom: 18 }}>
        <div className="row">
          <span className="caps faint grow">{servingCount > 1 ? "Per serving" : "Meal totals"}</span>
          <span className="stat neon">{r0(perServing.kcal)}<span style={{ fontSize: 14 }}> kcal</span></span>
        </div>
        <div className="grid3" style={{ marginTop: 14 }}>
          {[["Protein", r1(perServing.p)], ["Carbs", r1(perServing.c)], ["Fats", r1(perServing.f)]].map(([l, v]) => (
            <div className="nested" style={{ textAlign: "center" }} key={l}>
              <div className="caps faint" style={{ fontSize: 10 }}>{l}</div>
              <div className="stat-sm" style={{ marginTop: 6 }}>{v}g</div>
            </div>
          ))}
        </div>
        {servingCount > 1 && (
          <div className="dim" style={{ fontSize: 12.5, marginTop: 12 }}>
            Whole recipe: {r0(totals.kcal)} kcal · {r0(totals.p)} g protein across {servingCount} servings
          </div>
        )}
        {totals.kcal > 0 && (
          <div className="bar split" style={{ marginTop: 14 }}>
            <i style={{ width: `${(totals.p * 4 / totals.kcal) * 100}%`, background: "var(--accent)" }} />
            <i style={{ width: `${(totals.c * 4 / totals.kcal) * 100}%`, background: "var(--info)" }} />
            <i style={{ width: `${(totals.f * 9 / totals.kcal) * 100}%`, background: "var(--warn)" }} />
          </div>
        )}
      </div>

      <div className="sect-h"><h2 className="h4">Ingredients</h2><span className="caps faint">{items.length}</span></div>
      {items.length === 0 && (
        <div className="empty" style={{ padding: "22px 16px" }}>
          Search below and tap an ingredient to add it.
        </div>
      )}
      {items.map((it, i) => {
        const food = fmap[it.foodId];
        if (!food) return null;
        const m = macrosFor(food, it.amount, it.unit);
        return (
          <div className="list-row" key={i} style={{ marginBottom: 8 }}>
            <FoodAvatar food={food} size="sm" />
            <span className="grow">
              <span className="t" style={{ fontSize: 14 }}>{food.name}</span>
              <span className="d">{it.amount} {it.unit}</span>
            </span>
            <span className="tnum dim" style={{ fontSize: 13 }}>{r0(m.kcal)} kcal</span>
            <button className="icon-btn" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={`Remove ${food.name}`}>
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}

      <div style={{ marginTop: 18 }}>
        <FoodList
          query={q} setQuery={setQ} cat={cat} setCat={setCat}
          onPick={setPicking} onCreate={n => setCreating(n)}
        />
      </div>

      <div className="row" style={{ marginTop: 18, gap: 10 }}>
        <button
          className="btn btn-primary grow" disabled={!name.trim() || !items.length}
          onClick={() => { saveMeal({ id: meal.id, name: name.trim(), items, photo, servings: servingCount }); onClose(); }}
        >
          Save meal
        </button>
        {meal.existing && (
          <button className="btn btn-danger" onClick={() => { deleteMeal(meal.id); onClose(); }} aria-label="Delete meal">
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </>
  );
}

/* ── what you can do to a saved meal ──────────────────── */

function MealActions({ meal, onClose, onEdit }) {
  const [confirming, setConfirming] = useState(false);
  const fmap = foodMap();
  const t = mealServingMacros(meal);
  const makes = mealServings(meal);

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-h">
          <MealAvatar meal={meal} foodById={fmap} size="lg" />
          <span className="grow" style={{ minWidth: 0 }}>
            <h3 className="h4" style={{ margin: 0 }}>{meal.name}</h3>
            <span className="dim" style={{ fontSize: 12.5 }}>
              {meal.items.length} ingredients · {r0(t.kcal)} kcal · {r0(t.p)} g protein
              {makes > 1 ? " per serving" : ""}
            </span>
          </span>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        {!confirming ? (
          <>
            <button className="list-row" onClick={() => { onEdit(meal); }}>
              <span className="ico"><Pencil size={19} /></span>
              <span className="grow">
                <span className="t">Edit this meal</span>
                <span className="d">Change the name, add or remove ingredients, retune portions</span>
              </span>
            </button>

            <button className="list-row" onClick={() => { duplicateMeal(meal.id); onClose(); }}>
              <span className="ico"><Copy size={19} /></span>
              <span className="grow">
                <span className="t">Duplicate</span>
                <span className="d">Make a copy to build a variant without touching this one</span>
              </span>
            </button>

            <button className="list-row" onClick={() => setConfirming(true)}>
              <span className="ico" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                <Trash2 size={19} />
              </span>
              <span className="grow">
                <span className="t" style={{ color: "var(--danger)" }}>Delete</span>
                <span className="d">Removes the recipe — days you already logged keep their numbers</span>
              </span>
            </button>
          </>
        ) : (
          <>
            <p className="note danger" style={{ marginBottom: 16 }}>
              <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
              <b>Delete “{meal.name}”?</b> The recipe goes for good. Meals you already logged on past
              days are snapshots and keep their calories either way.
            </p>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-danger grow" onClick={() => { deleteMeal(meal.id); onClose(); }}>
                <Trash2 size={17} /> Delete it
              </button>
              <button className="btn btn-quiet" onClick={() => setConfirming(false)}>Keep it</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── screen ───────────────────────────────────────────── */

export default function Nutrition() {
  const meals = useStore(s => s.meals);
  const profile = useStore(s => s.profile);
  const customFoods = useStore(s => s.customFoods);
  useStore(s => s.log);

  const [view, setView] = useState("meals");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [editFood, setEditFood] = useState(null);
  const [acting, setActing] = useState(null);

  const fmap = foodMap();
  const totals = dayTotals(todayKey());
  const targets = targetsFor(todayKey());
  const pct = targets.kcal ? Math.round((totals.kcal / targets.kcal) * 100) : 0;

  return (
    <div className="page" style={{ paddingTop: 18 }}>
      <div className="card">
        <div className="row">
          <div className="grow">
            <div className="caps faint">{t("diet.intake")}</div>
            <div style={{ marginTop: 10 }}>
              <span className="stat neon">{r0(totals.kcal)}</span>
              <span className="dim" style={{ fontSize: 15 }}> / {targets.kcal}</span>
            </div>
            <div className="row wrap" style={{ gap: 14, marginTop: 12, fontSize: 13 }}>
              {[["P", totals.p, targets.p], ["C", totals.c, targets.c], ["F", totals.f, targets.f]].map(([l, v, t]) => (
                <span className="dim" key={l}>
                  {l} <b className="tnum" style={{ color: "var(--on-surface)" }}>{r0(v)}</b>/{t}g
                </span>
              ))}
            </div>
          </div>
          <Ring value={totals.kcal} max={targets.kcal} id="diet" size={86} stroke={10}>
            <span className="stat-sm">{pct}<span style={{ fontSize: 11 }}>%</span></span>
          </Ring>
        </div>
      </div>

      <div className="seg" style={{ marginTop: 18 }}>
        <button aria-pressed={view === "meals"} onClick={() => setView("meals")}>{t("diet.myMeals")}</button>
        <button aria-pressed={view === "db"} onClick={() => setView("db")}>{t("diet.ingredients")}</button>
        <button aria-pressed={view === "nutrients"} onClick={() => setView("nutrients")}>{t("diet.nutrients")}</button>
      </div>

      {view !== "nutrients" && (
        <p className="note" style={{ marginTop: 12 }}>
          <b>{view === "meals" ? "Meals are your recipes." : "Ingredients are the building blocks."}</b>{" "}
          {view === "meals"
            ? "Combine ingredients once — rice, chicken, olive oil — save it, and log the whole plate in one tap from the Today tab."
            : `Single foods with the numbers already filled in: banana, rice, chicken breast. Pick them to build a meal, or log one straight into a slot. ${allFoods().length} in here, and you can add your own.`}
        </p>
      )}

      {view === "nutrients" && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 20 }}>
            <FastingCard />
          </div>

          <div className="sect-h">
            <h2 className="h3">{t("diet.supplements")}</h2>
          </div>
          <Supplements />

          <div className="sect-h" style={{ marginTop: 30 }}>
            <h2 className="h3">Nutrients today</h2>
          </div>
          <NutrientPanel dateKey={todayKey()} />
        </div>
      )}

      {view === "meals" && (
        <>
          <button
            className="btn btn-primary btn-wide" style={{ marginTop: 16 }}
            onClick={() => setEditing({ id: newMealId(), name: "", items: [], existing: false })}
          >
            <Plus size={18} /> {t("diet.buildMeal")}
          </button>

          <div className="sect">
            <div className="sect-h"><h2 className="h3">{t("diet.savedMeals")}</h2><span className="caps faint">{meals.length}</span></div>

            {meals.length === 0 && (
              <div className="empty">
                <span className="empty-ico"><BookOpen size={24} /></span>
                <div style={{ marginBottom: 4, fontWeight: 600, color: "var(--on-surface)" }}>No meals yet — and none forced on you.</div>
                Build your own above, or drop in six starter recipes you can edit or delete freely.
                <div>
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={loadStarterMeals}>
                    <Download size={15} /> Load starter meals
                  </button>
                </div>
              </div>
            )}

            {meals.map(m => {
              const t = mealServingMacros(m);
              const makes = mealServings(m);
              return (
                <div key={m.id} className="list-row">
                  <MealAvatar meal={m} foodById={fmap} />
                  <button
                    className="grow" style={{ textAlign: "left", minWidth: 0 }}
                    onClick={() => setEditing({ ...m, existing: true })}
                  >
                    <span className="t">{m.name}</span>
                    <span className="d">
                      {m.items.length} ingredients · {r0(t.c)} g carbs · {r0(t.f)} g fat
                      {makes > 1 ? ` · makes ${makes}` : ""}
                    </span>
                  </button>
                  <span className="v" style={{ marginLeft: 0 }}>
                    <span className="stat-sm">{r0(t.kcal)}</span>
                    <span className="d neon">{r0(t.p)} g P{makes > 1 ? " / serving" : ""}</span>
                  </span>
                  <button
                    className="icon-btn" aria-label={`Actions for ${m.name}`}
                    onClick={() => setActing(m)}
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>
              );
            })}

            {meals.length > 0 && (
              <button className="btn btn-ghost btn-wide" style={{ marginTop: 6 }} onClick={loadStarterMeals}>
                <Sparkles size={15} /> Add the starter recipes too
              </button>
            )}
          </div>
        </>
      )}

      {view === "db" && (
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary btn-wide" style={{ marginBottom: 16 }} onClick={() => setEditFood({ food: null, name: "" })}>
            <Plus size={18} /> {t("diet.addFood")}
          </button>

          {customFoods.length > 0 && cat === "All" && !q && (
            <div className="sect-h" style={{ marginBottom: 10 }}>
              <h2 className="h4">Your foods</h2><span className="caps faint">{customFoods.length}</span>
            </div>
          )}
          {customFoods.length > 0 && cat === "All" && !q && customFoods.map(f => (
            <div className="list-row" key={f.id}>
              <FoodAvatar food={f} />
              <button className="grow" style={{ textAlign: "left" }} onClick={() => setEditFood({ food: f })}>
                <span className="t">{f.name}</span>
                <span className="d">{f.cat} · {f.kcal} kcal / 100 g</span>
              </button>
              <button className="icon-btn" aria-label={`Delete ${f.name}`} onClick={() => deleteCustomFood(f.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <div style={{ marginTop: customFoods.length ? 18 : 0 }}>
            <FoodList
              query={q} setQuery={setQ} cat={cat} setCat={setCat}
              onPick={setDetail} onCreate={name => setEditFood({ food: null, name })}
            />
          </div>
        </div>
      )}

      {acting && (
        <MealActions
          meal={acting}
          onClose={() => setActing(null)}
          onEdit={m => { setActing(null); setEditing({ ...m, existing: true }); }}
        />
      )}

      {editing && <Builder meal={editing} onClose={() => setEditing(null)} />}

      {editFood && (
        <div className="sheet-bg" onClick={() => setEditFood(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grabber" />
            <FoodEditor
              food={editFood.food} initialName={editFood.name || ""}
              onCancel={() => setEditFood(null)} onDone={() => setEditFood(null)}
            />
          </div>
        </div>
      )}

      {detail && (
        <div className="sheet-bg" onClick={() => setDetail(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grabber" />
            <div className="sheet-h">
              <FoodAvatar food={detail} size="lg" />
              <h3 className="h3 grow" style={{ margin: 0 }}>{detail.name}</h3>
              <button className="btn-ghost" onClick={() => setDetail(null)} aria-label="Close"><X size={22} /></button>
            </div>
            <div className="caps faint" style={{ marginBottom: 14 }}>{detail.cat} &middot; per 100 g</div>
            <div className="grid-auto" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[["kcal", detail.kcal], ["Prot", detail.p + "g"], ["Carb", detail.c + "g"], ["Fat", detail.f + "g"]].map(([l, v]) => (
                <div className="nested" style={{ textAlign: "center" }} key={l}>
                  <div className="caps faint" style={{ fontSize: 10 }}>{l}</div>
                  <div className="stat-sm" style={{ marginTop: 6 }}>{v}</div>
                </div>
              ))}
            </div>
            {nutrientsForGrams(detail.id, 100) && (
              <>
                <div className="sect-h" style={{ marginTop: 22 }}><h2 className="h4">Per 100 g, in full</h2></div>
                {(() => {
                  const row = nutrientsForGrams(detail.id, 100);
                  const shown = NUTRIENT_META.filter(m => row[m.key] != null);
                  return shown.map(m => (
                    <div className="entry" key={m.key}>
                      <span className="grow" style={{ fontSize: 14 }}>{m.label}</span>
                      <span className="tnum dim" style={{ fontSize: 13 }}>
                        {row[m.key] >= 100 ? Math.round(row[m.key]) : Math.round(row[m.key] * 10) / 10} {m.unit}
                      </span>
                    </div>
                  ));
                })()}
              </>
            )}

            <div className="sect-h" style={{ marginTop: 22 }}><h2 className="h4">Portions</h2></div>
            {detail.units.map(u => {
              const m = macrosFor(detail, 1, u.label);
              return (
                <div className="entry" key={u.label}>
                  <span className="grow" style={{ fontSize: 14 }}>1 {u.label} <span className="dim">&middot; {r0(u.g)} g</span></span>
                  <span className="tnum dim" style={{ fontSize: 13 }}>{r0(m.kcal)} kcal &middot; {r1(m.p)} g P</span>
                </div>
              );
            })}
            <p className="note" style={{ marginTop: 16 }}>
              <Info size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              To eat this today, open a meal slot on the <b>Today</b> tab and search for it there.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
