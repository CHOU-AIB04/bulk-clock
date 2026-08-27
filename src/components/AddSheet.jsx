import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X, ChevronLeft, Search, ScanLine, Plus, BookOpen, Zap, Pencil,
  Star, History, SlidersHorizontal, Flame
} from "lucide-react";
import { CATEGORIES, macrosFor } from "../data/foods.js";
import {
  useStore, mealMacros, mealServingMacros, mealServings, logFood, logMeal, logQuick,
  searchAllFoods, allFoods, saveCustomFood, foodMap, newId,
  recentlyLogged, frequentlyLogged, lastPortionFor,
  isFavourite, toggleFavourite, favouriteFoods, favouriteMeals, getFood
} from "../lib/store.js";
import FoodAvatar, { MealAvatar } from "./FoodAvatar.jsx";
import CopyDaySheet from "./CopyDaySheet.jsx";
import MealPortion from "./MealPortion.jsx";
import { tapMedium } from "../lib/haptics.js";

const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;

/* ── portion picker ───────────────────────────────────── */

export function Portion({ food, onDone, onBack, ctaLabel = "Add to log", initial = null, remember = true }) {
  // Start from the portion you used last time for this food, then the food's own
  // natural unit, then plain grams. Typing 180 g of chicken every single day is
  // the kind of small friction that stops people logging at all.
  const memory = remember && !initial ? lastPortionFor(food.id) : null;
  const start = initial || memory;
  const validUnit = start && food.units.some(u => u.label === start.unit) ? start.unit : null;

  const [amount, setAmount] = useState(() => (validUnit ? start.amount : food.units.length > 1 ? 1 : 100));
  const [unit, setUnit] = useState(() => validUnit || food.units[food.units.length > 1 ? 1 : 0].label);
  const m = macrosFor(food, Number(amount) || 0, unit);

  return (
    <>
      <div className="sheet-h">
        <button className="btn-ghost" onClick={onBack} aria-label="Back"><ChevronLeft size={22} /></button>
        <FoodAvatar food={food} />
        <h3 className="h4 grow" style={{ margin: 0 }}>{food.name}</h3>
      </div>

      <div className="row" style={{ gap: 10 }}>
        <input
          className="input num grow" type="number" inputMode="decimal" min="0" step="any"
          value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount" autoFocus
        />
        <select
          className="input grow" value={unit} aria-label="Unit"
          onChange={e => {
            // Switching units rescales the amount, so "1 fillet" never becomes "150 fillets".
            setUnit(e.target.value);
            setAmount(e.target.value === "g" ? 100 : 1);
          }}
        >
          {food.units.map(u => (
            <option key={u.label} value={u.label}>{u.label}{u.g !== 1 ? ` (${u.g} g)` : ""}</option>
          ))}
        </select>
      </div>

      <div className="grid-auto" style={{ marginTop: 16, gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {[["kcal", r0(m.kcal)], ["Prot", r1(m.p) + "g"], ["Carb", r1(m.c) + "g"], ["Fat", r1(m.f) + "g"]].map(([l, v]) => (
          <div className="nested" style={{ textAlign: "center" }} key={l}>
            <div className="caps faint" style={{ fontSize: 10 }}>{l}</div>
            <div className="stat-sm" style={{ marginTop: 6 }}>{v}</div>
          </div>
        ))}
      </div>

      <p className="note" style={{ marginTop: 14 }}>
        {r0(m.grams)} g total &middot; {food.kcal} kcal per 100 g
        {memory && validUnit ? <> &middot; <b>your usual portion</b></> : null}
      </p>

      <button
        className="btn btn-primary btn-wide" style={{ marginTop: 18 }}
        disabled={!(Number(amount) > 0)}
        onClick={() => onDone(food, Number(amount), unit)}
      >
        {ctaLabel}
      </button>
    </>
  );
}

/** A star that pins something to the top of every picker. */
export function FavStar({ kind, id }) {
  useStore(s => s.favourites);
  const on = isFavourite(kind, id);
  return (
    <button
      className="icon-btn star"
      aria-pressed={on}
      aria-label={on ? "Remove from favourites" : "Add to favourites"}
      onClick={e => { e.stopPropagation(); toggleFavourite(kind, id); }}
    >
      <Star size={17} fill={on ? "currentColor" : "none"} />
    </button>
  );
}

/* ── a searchable list of ingredients ─────────────────── */

export function FoodList({ query, setQuery, cat, setCat, onPick, autoFocus, onCreate }) {
  useStore(s => s.customFoods);
  const results = useMemo(() => searchAllFoods(query, cat), [query, cat]);

  return (
    <>
      <div className="search-wrap">
        <Search size={20} />
        <input
          className="input" value={query} onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${allFoods().length} ingredients…`} autoFocus={autoFocus}
        />
      </div>
      <div className="chips scroll-x" style={{ margin: "12px 0 14px" }}>
        {["All", "My foods", ...CATEGORIES].map(c => (
          <button key={c} className="chip chip-outline" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      {results.length === 0 && (
        <div className="empty">
          <span className="empty-ico"><Search size={24} /></span>
          Nothing matched{query ? ` “${query}”` : ""}.
          {onCreate && (
            <div>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 14 }} onClick={() => onCreate(query)}>
                <Plus size={15} /> Add “{query || "a new food"}” yourself
              </button>
            </div>
          )}
        </div>
      )}

      {results.map(f => (
        <div key={f.id} className="list-row">
          <FoodAvatar food={f} />
          <button className="grow" style={{ textAlign: "left", minWidth: 0 }} onClick={() => onPick(f)}>
            <span className="t">{f.name}</span>
            <span className="d">{f.cat}{f.custom ? " · yours" : ""}</span>
          </button>
          <span className="v" style={{ marginLeft: 0 }}>
            <span className="stat-sm">{f.kcal}</span>
            <span className="d">per 100 g</span>
          </span>
          <FavStar kind="food" id={f.id} />
        </div>
      ))}
    </>
  );
}

/* ── one-tap rows: favourites, recents, most logged ───── */

function QuickList({ items, fmap, meals, onLog, onTune, emptyNote }) {
  if (!items.length) return emptyNote ? <p className="note" style={{ marginBottom: 14 }}>{emptyNote}</p> : null;

  return (
    <>
      {items.map(entry => {
        const isMeal = entry.kind === "meal";
        const meal = isMeal ? meals.find(m => m.id === entry.ref) : null;
        const food = isMeal ? null : getFood(entry.ref);
        if (!meal && !food) return null;

        const totals = isMeal ? mealMacros(meal) : macrosFor(food, entry.amount, entry.unit);
        const portion = isMeal
          ? `${entry.amount} ${entry.unit}`
          : `${entry.amount} ${entry.unit}`;

        return (
          <div className="list-row" key={(isMeal ? "m" : "f") + entry.ref}>
            {isMeal
              ? <MealAvatar meal={meal} foodById={fmap} />
              : <FoodAvatar food={food} />}
            <button
              className="grow" style={{ textAlign: "left", minWidth: 0 }}
              onClick={() => onLog(entry)}
            >
              <span className="t">{isMeal ? meal.name : food.name}</span>
              <span className="d">
                {portion}{entry.count > 1 ? ` · logged ${entry.count}×` : ""}
              </span>
            </button>
            <span className="v" style={{ marginLeft: 0 }}>
              <span className="stat-sm">{r0(totals.kcal)}</span>
              <span className="d neon">{r0(totals.p)} g P</span>
            </span>
            <button
              className="icon-btn" aria-label={`Change the portion of ${isMeal ? meal.name : food.name}`}
              onClick={() => onTune(entry)}
            >
              <SlidersHorizontal size={17} />
            </button>
          </div>
        );
      })}
    </>
  );
}

/* ── create your own ingredient ───────────────────────── */

export function FoodEditor({ initialName = "", food = null, onDone, onCancel }) {
  const [v, setV] = useState(() => ({
    name: food?.name || initialName,
    cat: food?.cat || "My foods",
    kcal: food?.kcal ?? "",
    p: food?.p ?? "",
    c: food?.c ?? "",
    f: food?.f ?? "",
    serving: food?.units?.find(u => u.label === "serving")?.g ?? ""
  }));
  const set = k => e => setV({ ...v, [k]: e.target.value });
  const ok = v.name.trim() && Number(v.kcal) >= 0 && v.kcal !== "";

  function save() {
    const units = [{ label: "g", g: 1 }];
    if (Number(v.serving) > 0) units.push({ label: "serving", g: Number(v.serving) });
    const next = {
      id: food?.id || `my_${newId()}`,
      name: v.name.trim(),
      cat: v.cat,
      kcal: Number(v.kcal) || 0,
      p: Number(v.p) || 0,
      c: Number(v.c) || 0,
      f: Number(v.f) || 0,
      units,
      custom: true
    };
    saveCustomFood(next);
    onDone(next);
  }

  return (
    <>
      <div className="sheet-h">
        <button className="btn-ghost" onClick={onCancel} aria-label="Back"><ChevronLeft size={22} /></button>
        <h3 className="h3 grow" style={{ margin: 0 }}>{food ? "Edit food" : "New food"}</h3>
      </div>

      <label className="field">
        <span className="lab">Name</span>
        <input className="input" value={v.name} onChange={set("name")} placeholder="Mum's msemen" autoFocus />
      </label>

      <label className="field">
        <span className="lab">Category</span>
        <select className="input" value={v.cat} onChange={set("cat")}>
          {["My foods", ...CATEGORIES].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <div className="caps faint" style={{ marginBottom: 10 }}>Per 100 g</div>
      <div className="grid-auto" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {[["kcal", "kcal"], ["p", "Prot"], ["c", "Carb"], ["f", "Fat"]].map(([k, l]) => (
          <label className="nested" key={k} style={{ textAlign: "center" }}>
            <span className="caps faint" style={{ fontSize: 10 }}>{l}</span>
            <input
              className="input num" style={{ marginTop: 6, padding: "8px 4px", fontSize: 18, background: "var(--surface)" }}
              inputMode="decimal" value={v[k]} onChange={set(k)} placeholder="0" aria-label={l}
            />
          </label>
        ))}
      </div>

      <label className="field" style={{ marginTop: 18 }}>
        <span className="lab">One serving weighs (optional)</span>
        <input className="input num" inputMode="decimal" value={v.serving} onChange={set("serving")} placeholder="e.g. 85" />
      </label>

      <p className="note">
        Values go in <b>per 100 g</b>, the same basis the rest of the database uses — that is what
        makes every portion size calculate correctly afterwards.
      </p>

      <button className="btn btn-primary btn-wide" style={{ marginTop: 16 }} disabled={!ok} onClick={save}>
        Save food
      </button>
    </>
  );
}

/* ── barcode ──────────────────────────────────────────── */

function Scan({ onFound }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stream, raf, detector, stopped = false;
    async function start() {
      if (!("BarcodeDetector" in window)) { setStatus("unsupported"); return; }
      try {
        detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("scanning");
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length) { lookup(codes[0].rawValue); return; }
          } catch { /* frame not ready */ }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setStatus("denied");
      }
    }
    start();
    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function lookup(code) {
    setBusy(true); setStatus("looking");
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments,serving_size,image_front_small_url`
      );
      const data = await res.json();
      const n = data?.product?.nutriments;
      if (data.status !== 1 || !n || n["energy-kcal_100g"] == null) { setStatus("notfound"); setBusy(false); return; }
      onFound({
        id: `off_${code}`,
        name: [data.product.brands?.split(",")[0], data.product.product_name].filter(Boolean).join(" — ") || `Barcode ${code}`,
        cat: "Scanned",
        photo: data.product.image_front_small_url || null,
        kcal: +n["energy-kcal_100g"] || 0,
        p: +n.proteins_100g || 0,
        c: +n.carbohydrates_100g || 0,
        f: +n.fat_100g || 0,
        units: [{ label: "g", g: 1 }, { label: "serving", g: parseFloat(data.product.serving_size) || 100 }]
      });
    } catch {
      setStatus("offline");
    }
    setBusy(false);
  }

  const msg = {
    scanning: "Point the camera at a barcode.",
    looking: "Looking the product up…",
    idle: "Starting the camera…",
    unsupported: "This device can't scan in-app. Type the barcode below instead.",
    denied: "Camera unavailable. Allow camera access in Android settings, or type the number below.",
    notfound: "Not in Open Food Facts. Try another code, or add it yourself.",
    offline: "No connection. Barcode lookup is the only feature that needs internet."
  }[status];

  return (
    <>
      {status !== "unsupported" && status !== "denied" && (
        <div className="scanbox"><video ref={videoRef} playsInline muted /><div className="frame" /></div>
      )}
      <p className={"note " + (["notfound", "offline", "denied", "unsupported"].includes(status) ? "warn" : "")} style={{ marginTop: 14 }}>
        {msg}
      </p>
      <label className="field" style={{ marginTop: 16 }}>
        <span className="lab">Or enter the barcode</span>
        <div className="row" style={{ gap: 10 }}>
          <input
            className="input num grow" inputMode="numeric" value={manual}
            onChange={e => setManual(e.target.value.replace(/\D/g, ""))} placeholder="6111…"
          />
          <button className="btn btn-primary" disabled={manual.length < 8 || busy} onClick={() => lookup(manual)}>
            {busy ? "…" : "Look up"}
          </button>
        </div>
      </label>
    </>
  );
}

/* ── quick add ────────────────────────────────────────── */

function Quick({ onAdd }) {
  const [v, setV] = useState({ name: "", kcal: "", p: "", c: "", f: "" });
  const set = k => e => setV({ ...v, [k]: e.target.value });
  const ok = v.name.trim() && Number(v.kcal) > 0;
  return (
    <>
      <label className="field">
        <span className="lab">What was it</span>
        <input className="input" value={v.name} onChange={set("name")} placeholder="Restaurant tagine" />
      </label>
      <div className="grid-auto" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {[["kcal", "kcal"], ["p", "Prot"], ["c", "Carb"], ["f", "Fat"]].map(([k, l]) => (
          <label className="nested" key={k} style={{ textAlign: "center" }}>
            <span className="caps faint" style={{ fontSize: 10 }}>{l}</span>
            <input
              className="input num" style={{ marginTop: 6, padding: "8px 4px", fontSize: 18, background: "var(--surface)" }}
              inputMode="decimal" value={v[k]} onChange={set(k)} placeholder="0" aria-label={l}
            />
          </label>
        ))}
      </div>
      <p className="note" style={{ marginTop: 16 }}>
        A quick entry lands in today's log only. If you'll eat it again, add it as a food instead so
        it comes back with its portions.
      </p>
      <button className="btn btn-primary btn-wide" style={{ marginTop: 16 }} disabled={!ok} onClick={() => onAdd(v)}>
        Add to log
      </button>
    </>
  );
}

/* ── the sheet ────────────────────────────────────────── */

/**
 * `mode` is either "log" — the entry lands in today's totals — or "plan", where
 * the same picker records an intention for a future day instead. Everything
 * below is identical either way except where the chosen item ends up, which is
 * the point: planning a meal should not be a different skill from logging one.
 */
export default function AddSheet({ dateKey, slot, onClose, mode = "log", onPlan }) {
  const meals = useStore(s => s.meals);
  useStore(s => s.log);
  useStore(s => s.favourites);

  const recent = recentlyLogged(10);
  const frequent = frequentlyLogged(8);
  const favFoods = favouriteFoods();
  const favMeals = favouriteMeals();
  const hasQuick = recent.length || frequent.length || favFoods.length || favMeals.length;

  const [tab, setTab] = useState(() => (hasQuick ? "recent" : meals.length ? "meals" : "foods"));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [picking, setPicking] = useState(null);
  const [pickInitial, setPickInitial] = useState(null);
  const [pickingMeal, setPickingMeal] = useState(null);
  const [creating, setCreating] = useState(null);
  const [copying, setCopying] = useState(false);

  const fmap = foodMap();
  const mealTotals = useMemo(() => Object.fromEntries(meals.map(m => [m.id, mealServingMacros(m)])), [meals]);

  const planning = mode === "plan";

  /** Where a chosen item ends up: today's log, or a future day's plan. */
  function commitFood(food, amount, unit) {
    if (planning) onPlan({ kind: "food", ref: food.id, amount, unit });
    else logFood(dateKey, slot.id, food, amount, unit);
    onClose();
  }

  function commitMeal(meal, portions = 1) {
    if (planning) onPlan({ kind: "meal", ref: meal.id, amount: portions, unit: "serving" });
    else logMeal(dateKey, slot.id, meal, portions);
    onClose();
  }

  /** One tap logs it at the portion you last used. */
  function quickLog(entry) {
    tapMedium();
    if (entry.kind === "meal") {
      const meal = meals.find(m => m.id === entry.ref);
      if (meal) commitMeal(meal, entry.amount || 1);
      else onClose();
    } else {
      const food = getFood(entry.ref);
      if (food) commitFood(food, entry.amount, entry.unit);
      else onClose();
    }
  }

  /** The same row, but stop at the portion picker instead of logging. */
  function tune(entry) {
    if (entry.kind === "meal") {
      const meal = meals.find(m => m.id === entry.ref);
      if (meal) setPickingMeal(meal);
      return;
    }
    const food = getFood(entry.ref);
    if (!food) return;
    setPickInitial({ amount: entry.amount, unit: entry.unit });
    setPicking(food);
  }

  const favouriteRows = [
    ...favMeals.map(m => ({ kind: "meal", ref: m.id, amount: 1, unit: "serving", count: 0 })),
    ...favFoods.map(f => {
      const p = lastPortionFor(f.id);
      return { kind: "food", ref: f.id, amount: p?.amount ?? (f.units.length > 1 ? 1 : 100), unit: p?.unit ?? f.units[f.units.length > 1 ? 1 : 0].label, count: 0 };
    })
  ];

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
        food={picking} initial={pickInitial}
        onBack={() => { setPicking(null); setPickInitial(null); }}
        ctaLabel={planning ? "Add to the plan" : "Add to log"}
        onDone={(food, amount, unit) => commitFood(food, amount, unit)}
      />
    );
  }

  if (copying) {
    return <CopyDaySheet dateKey={dateKey} slot={slot} onClose={onClose} />;
  }

  if (pickingMeal) {
    return wrap(
      <MealPortion
        meal={pickingMeal} onBack={() => setPickingMeal(null)}
        ctaLabel={planning ? "Add to the plan" : "Add to log"}
        onDone={(meal, portions) => commitMeal(meal, portions)}
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
        <h3 className="h3">{planning ? "Plan" : "Add to"} {slot.name}</h3>
        <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
      </div>

      <div className="chips scroll-x" style={{ marginBottom: 16 }}>
        {[
          ...(hasQuick ? [["recent", "Quick add", History]] : []),
          ["meals", "My meals", BookOpen],
          ["foods", "Ingredients", Search],
          ...(planning ? [] : [["scan", "Scan", ScanLine], ["quick", "Custom", Zap]])
        ].map(([k, l, Ico]) => (
          <button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>
            <Ico size={13} style={{ marginRight: 5, verticalAlign: -2 }} />{l}
          </button>
        ))}
      </div>

      {tab === "recent" && (
        <>
          {!planning && (
          <button className="list-row" onClick={() => setCopying(true)}>
            <span className="ico"><History size={19} /></span>
            <span className="grow">
              <span className="t">Copy {slot.name} from another day</span>
              <span className="d">Lift the whole meal off a day you already logged</span>
            </span>
          </button>
          )}

          <p className="note" style={{ margin: "14px 0 16px" }}>
            <b>One tap logs it</b> at the portion you used last time. The slider button opens the
            portion picker instead.
          </p>

          {favouriteRows.length > 0 && (
            <>
              <div className="sect-h" style={{ marginBottom: 10 }}>
                <h2 className="h4"><Star size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Favourites</h2>
              </div>
              <QuickList items={favouriteRows} fmap={fmap} meals={meals} onLog={quickLog} onTune={tune} />
            </>
          )}

          {recent.length > 0 && (
            <>
              <div className="sect-h" style={{ marginBottom: 10, marginTop: favouriteRows.length ? 22 : 0 }}>
                <h2 className="h4"><History size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Recent</h2>
              </div>
              <QuickList items={recent} fmap={fmap} meals={meals} onLog={quickLog} onTune={tune} />
            </>
          )}

          {frequent.length > 0 && (
            <>
              <div className="sect-h" style={{ marginBottom: 10, marginTop: 22 }}>
                <h2 className="h4"><Flame size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Most logged</h2>
              </div>
              <QuickList items={frequent} fmap={fmap} meals={meals} onLog={quickLog} onTune={tune} />
            </>
          )}
        </>
      )}

      {tab === "meals" && (
        <>
          {meals.length === 0 && (
            <div className="empty">
              <span className="empty-ico"><BookOpen size={24} /></span>
              No saved meals yet. Build one on the Diet tab and it lands here for one-tap logging.
            </div>
          )}
          {meals.map(m => {
            const t = mealTotals[m.id];
            const makes = mealServings(m);
            return (
              <div key={m.id} className="list-row">
                <MealAvatar meal={m} foodById={fmap} />
                <button
                  className="grow" style={{ textAlign: "left", minWidth: 0 }}
                  onClick={() => setPickingMeal(m)}
                >
                  <span className="t">{m.name}</span>
                  <span className="d">
                    {m.items.length} ingredient{m.items.length === 1 ? "" : "s"}
                    {makes > 1 ? ` · makes ${makes}` : ""}
                  </span>
                </button>
                <span className="v" style={{ marginLeft: 0 }}>
                  <span className="stat-sm">{r0(t.kcal)}</span>
                  <span className="d neon">{r0(t.p)} g P</span>
                </span>
                <FavStar kind="meal" id={m.id} />
              </div>
            );
          })}
        </>
      )}

      {tab === "foods" && (
        <>
          <FoodList
            query={q} setQuery={setQ} cat={cat} setCat={setCat}
            onPick={setPicking} autoFocus onCreate={name => setCreating(name)}
          />
          <button className="btn btn-secondary btn-wide" style={{ marginTop: 14 }} onClick={() => setCreating(q)}>
            <Pencil size={16} /> Add a food that isn't here
          </button>
        </>
      )}

      {tab === "scan" && <Scan onFound={f => setPicking(f)} />}

      {tab === "quick" && (
        <Quick onAdd={v => { logQuick(dateKey, slot.id, v.name.trim(), v.kcal, v.p, v.c, v.f); onClose(); }} />
      )}
    </>
  );
}
