import { useSyncExternalStore } from "react";
import { DEFAULT_SLOTS, SEED_MEALS, DEFAULT_PROGRAM, emptyProgram } from "../data/program.js";
import { FOOD_BY_ID, FOODS, macrosFor, searchFoods } from "../data/foods.js";
import { readSnapshot, writeSnapshot, flush, installFlushHooks } from "./persist.js";
import { NUTRIENT_FIELDS, nutrientsForGrams } from "../data/nutrients.js";

const KEY = "bulkclock.state.v1";

const DEFAULT_STATE = {
  v: 4,
  profile: {
    onboarded: false,
    name: "",
    photo: null,
    sex: "male",
    age: 22,
    height: 165,
    weight: 52,
    startWeight: 52,
    goalWeight: 62,
    objective: "build",
    archetype: "meso",
    activity: "sed",
    trainingDays: 4,
    wakeTime: "08:30",
    mealCount: 4,
    kcalTarget: 2590,
    pTarget: 140,
    cTarget: 343,
    fTarget: 73,
    programStart: "2026-08-31",
    slots: DEFAULT_SLOTS
  },
  /** log[dateKey] = { entries: [...], weight: number|null } */
  log: {},
  /** checkins[dateKey] = { meals: { slotId: "yes"|"no" }, trained: "yes"|"no" } */
  checkins: {},
  /** Saved recipes. Empty by default — starter meals are opt-in, not forced. */
  meals: [],
  /** Foods the user typed in themselves, merged into the database. */
  customFoods: [],
  /** Starred foods and meals, pinned to the top of every picker. */
  favourites: { foods: [], meals: [] },
  /** measurements[dateKey] = { waist, chest, arm, thigh, hips, neck } in cm */
  measurements: {},
  /** photos[dateKey] = { front, side, back } — image ids, stored on device */
  photos: {},
  /**
   * lifts[dateKey] = {
   *   ex: { [exerciseName]: { sets: [{ w, r, rpe, type, done }], note } },
   *   startedAt, endedAt, note
   * }
   * `type` is "work" | "warmup" | "drop"; only work sets count toward volume.
   */
  lifts: {},
  /** The editable training week. `days[1..7]` — a missing day is a rest day. */
  program: DEFAULT_PROGRAM,
  /** One-off "I'm training at a different time today" overrides, by date key. */
  sessionOverride: {},
  challenges: [],
  settings: {
    theme: "dark",              // "dark" | "light" | "system"
    notifyMeals: true,
    notifyTraining: true,
    notifyWeighIn: false,
    notifyCheckin: true,
    notifyRestDay: false,
    trainingTime: "17:00",
    weighInTime: "08:00",
    checkinTime: "21:30",
    trackWeight: true,
    waterTargetMl: 3000,
    waterGlassMl: 250,
    notifyWater: false,
    barWeight: 20,
    units: "metric",
    /** Carb-cycle: eat more on days you lift, less on days you don't. */
    dayTypeTargets: false,
    dayTypeSwing: 0.15,
    /** Judge the week, not the day. */
    weeklyBudget: false,
    lastTdeeCheck: null
  }
};

/* ── persistence ─────────────────────────────────────────── */

/** Bring a state saved by an older build up to the current shape. */
function migrate(parsed) {
  const next = {
    ...structuredClone(DEFAULT_STATE),
    ...parsed,
    profile: { ...DEFAULT_STATE.profile, ...(parsed.profile || {}) },
    settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
    checkins: parsed.checkins || {},
    customFoods: parsed.customFoods || [],
    sessionOverride: parsed.sessionOverride || {},
    favourites: {
      foods: parsed.favourites?.foods || [],
      meals: parsed.favourites?.meals || []
    },
    measurements: parsed.measurements || {},
    photos: parsed.photos || {}
  };
  // v2 had no editable program — adopt the bundled split as the starting week.
  if (!next.program || !next.program.days) next.program = structuredClone(DEFAULT_PROGRAM);

  // v3 stored a session as { exerciseName: [[kg, reps], ...] }. Sets are now
  // objects so they can carry effort, set type and a completion tick.
  for (const [key, day] of Object.entries(next.lifts || {})) {
    if (!day || day.ex) continue;
    const ex = {};
    for (const [name, sets] of Object.entries(day)) {
      if (!Array.isArray(sets)) continue;
      ex[name] = {
        sets: sets.map(pair => ({
          w: Array.isArray(pair) ? pair[0] ?? null : null,
          r: Array.isArray(pair) ? pair[1] ?? null : null,
          rpe: null,
          type: "work",
          done: Array.isArray(pair) && pair[0] != null && pair[1] != null
        })),
        note: ""
      };
    }
    next.lifts[key] = { ex, startedAt: null, endedAt: null, note: "" };
  }

  next.v = 4;
  return next;
}

function parse(raw) {
  try {
    if (!raw) return structuredClone(DEFAULT_STATE);
    return migrate(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

/**
 * Start from whatever the synchronous store holds so the first paint is never
 * blank on the web, then let `hydrate()` replace it with the durable copy.
 */
let state = parse(typeof localStorage !== "undefined" ? (() => {
  try { return localStorage.getItem(KEY); } catch { return null; }
})() : null);

let hydrated = false;
const listeners = new Set();

/** Load the durable snapshot. Called once, before the app renders. */
export async function hydrate() {
  if (hydrated) return state;
  hydrated = true;
  const raw = await readSnapshot();
  if (raw) {
    state = parse(raw);
    listeners.forEach(l => l());
  }
  installFlushHooks();
  return state;
}

export function flushState() {
  return flush();
}

function emit() {
  writeSnapshot(JSON.stringify(state));
  listeners.forEach(l => l());
}

/** Apply a mutation to a draft of state and publish the result. */
export function update(fn) {
  const draft = structuredClone(state);
  fn(draft);
  state = draft;
  emit();
}

export function getState() {
  return state;
}

export function useStore(selector = s => s) {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(state)
  );
}

export function replaceState(next) {
  state = migrate(next);
  emit();
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

/* ── dates ───────────────────────────────────────────────── */

export const pad = n => String(n).padStart(2, "0");

export function dkey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The logging day rolls over at 04:00 — a 01:00 snack belongs to yesterday. */
export function logicalDate(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return d;
}

export function todayKey() {
  return dkey(logicalDate());
}

export function weekOfBlock(key = todayKey()) {
  const days = Math.floor((parseKey(key) - parseKey(state.profile.programStart)) / 86400000);
  return Math.floor(days / 7) + 1;
}

export function weekdayOf(key = todayKey()) {
  const wd = parseKey(key).getDay();
  return wd === 0 ? 7 : wd; // 1 = Mon … 7 = Sun
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dkey(d);
}

/* ── foods: bundled database + the user's own ────────────── */

/** Custom foods win on id collision, so a user can shadow a bundled entry. */
export function getFood(id) {
  return state.customFoods.find(f => f.id === id) || FOOD_BY_ID[id] || null;
}

export function allFoods() {
  return state.customFoods.length ? [...state.customFoods, ...FOODS] : FOODS;
}

export function foodMap() {
  const m = { ...FOOD_BY_ID };
  for (const f of state.customFoods) m[f.id] = f;
  return m;
}

/** Search that spans both sets, with the user's own foods surfaced first. */
export function searchAllFoods(query, cat) {
  const q = query.trim().toLowerCase();
  const mine = state.customFoods.filter(f => {
    // "My foods" is a view, not a real category — it means everything you added.
    if (cat && cat !== "All" && cat !== "My foods" && f.cat !== cat) return false;
    return !q || f.name.toLowerCase().includes(q);
  });
  if (cat === "My foods") return mine;
  return mine.length ? [...mine, ...searchFoods(query, cat)] : searchFoods(query, cat);
}

export function saveCustomFood(food) {
  update(d => {
    const i = d.customFoods.findIndex(f => f.id === food.id);
    if (i >= 0) d.customFoods[i] = food;
    else d.customFoods.unshift(food);
  });
}

export function deleteCustomFood(id) {
  update(d => {
    d.customFoods = d.customFoods.filter(f => f.id !== id);
  });
}

/* ── macros ──────────────────────────────────────────────── */

export const ZERO = { kcal: 0, p: 0, c: 0, f: 0 };

export function sumMacros(list) {
  return list.reduce(
    (a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + x.p, c: a.c + x.c, f: a.f + x.f }),
    { ...ZERO }
  );
}

/**
 * How many portions a recipe makes. A family tagine built from a kilo of meat is
 * not one serving, and logging it as one is how a day silently gains 2 000 kcal.
 */
export function mealServings(meal) {
  const n = Number(meal?.servings);
  return n > 0 ? n : 1;
}

/** Macros for a single portion of a recipe — what actually gets logged. */
export function mealServingMacros(meal) {
  const total = mealMacros(meal);
  const n = mealServings(meal);
  return { kcal: total.kcal / n, p: total.p / n, c: total.c / n, f: total.f / n };
}

/** Totals for the WHOLE recipe as built, resolved against the food database. */
export function mealMacros(meal) {
  return sumMacros(
    (meal.items || []).map(it => {
      const food = getFood(it.foodId);
      if (!food) return { ...ZERO };
      return macrosFor(food, it.amount, it.unit);
    })
  );
}

export function dayEntries(key) {
  return state.log[key]?.entries || [];
}

export function dayTotals(key) {
  return sumMacros(dayEntries(key));
}

/* ── mutations ───────────────────────────────────────────── */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const newId = uid;

function ensureDay(draft, key) {
  if (!draft.log[key]) draft.log[key] = { entries: [], weight: null, water: 0 };
  if (!draft.log[key].entries) draft.log[key].entries = [];
  if (draft.log[key].water == null) draft.log[key].water = 0;
  return draft.log[key];
}

/** Macros are snapshotted at log time so later database edits never rewrite history. */
export function logFood(key, slot, food, amount, unit) {
  const m = macrosFor(food, amount, unit);
  update(d => {
    ensureDay(d, key).entries.push({
      id: uid(),
      kind: "food",
      ref: food.id,
      name: food.name,
      amount,
      unit,
      grams: m.grams,
      kcal: m.kcal,
      p: m.p,
      c: m.c,
      f: m.f,
      slot
    });
  });
}

/** `portions` is measured in servings of the recipe, not copies of the recipe. */
export function logMeal(key, slot, meal, portions = 1) {
  const m = mealServingMacros(meal);
  update(d => {
    ensureDay(d, key).entries.push({
      id: uid(),
      kind: "meal",
      ref: meal.id,
      name: meal.name,
      amount: portions,
      unit: portions === 1 ? "serving" : "servings",
      kcal: m.kcal * portions,
      p: m.p * portions,
      c: m.c * portions,
      f: m.f * portions,
      slot
    });
  });
}

export function logQuick(key, slot, name, kcal, p, c, f) {
  update(d => {
    ensureDay(d, key).entries.push({
      id: uid(), kind: "quick", ref: null, name,
      amount: 1, unit: "entry",
      kcal: +kcal || 0, p: +p || 0, c: +c || 0, f: +f || 0, slot
    });
  });
}

export function removeEntry(key, id) {
  update(d => {
    const day = d.log[key];
    if (day) day.entries = day.entries.filter(e => e.id !== id);
  });
}

export function setWeight(key, kg) {
  update(d => {
    ensureDay(d, key).weight = kg === "" || kg == null ? null : Number(kg);
  });
}

export function saveMeal(meal) {
  update(d => {
    const i = d.meals.findIndex(m => m.id === meal.id);
    if (i >= 0) d.meals[i] = meal;
    else d.meals.push({ ...meal, id: meal.id || uid() });
  });
}

export function deleteMeal(id) {
  const target = state.meals.find(m => m.id === id);
  const stillUsed = state.meals.some(m => m.id !== id && m.photo && m.photo === target?.photo);
  const photo = stillUsed ? null : target?.photo;
  update(d => {
    d.meals = d.meals.filter(m => m.id !== id);
  });
  // The photo has no other owner, so it goes too rather than sitting on disk.
  if (photo) import("./images.js").then(m => m.deleteImage(photo)).catch(() => {});
}

export function newMealId() {
  return uid();
}

/** Copy a saved meal so a variant can be built without destroying the original. */
export function duplicateMeal(id) {
  let newIdCreated = null;
  update(d => {
    const m = d.meals.find(x => x.id === id);
    if (!m) return;
    newIdCreated = uid();
    const base = m.name.replace(/ \(copy( \d+)?\)$/, "");
    let name = `${base} (copy)`;
    let n = 2;
    while (d.meals.some(x => x.name === name)) name = `${base} (copy ${n++})`;
    // The copy points at the same photo file; deleting one meal must not orphan
    // the other's picture, so `deleteMeal` checks for remaining owners.
    d.meals.push({ id: newIdCreated, name, items: structuredClone(m.items), photo: m.photo || null });
  });
  return newIdCreated;
}

/** Drop the bundled starter recipes in, skipping any the user already has. */
export function loadStarterMeals() {
  update(d => {
    for (const m of SEED_MEALS) {
      if (!d.meals.some(x => x.id === m.id)) d.meals.push(structuredClone(m));
    }
  });
}

/* ── check-ins ───────────────────────────────────────────── */

export function checkinFor(key) {
  return state.checkins[key] || { meals: {}, trained: null };
}

export function setMealCheck(key, slotId, value) {
  update(d => {
    if (!d.checkins[key]) d.checkins[key] = { meals: {}, trained: null };
    if (!d.checkins[key].meals) d.checkins[key].meals = {};
    const cur = d.checkins[key].meals[slotId];
    d.checkins[key].meals[slotId] = cur === value ? null : value;
  });
}

export function setTrainedCheck(key, value) {
  update(d => {
    if (!d.checkins[key]) d.checkins[key] = { meals: {}, trained: null };
    d.checkins[key].trained = d.checkins[key].trained === value ? null : value;
  });
}

/**
 * A day's consistency: meals confirmed eaten (either ticked, or logged with food)
 * over meals planned, plus the training question when a session was scheduled.
 */
export function dayConsistency(key) {
  const slots = state.profile.slots || [];
  const ci = checkinFor(key);
  const entries = dayEntries(key);
  const logged = new Set(entries.map(e => e.slot));

  let done = 0;
  for (const s of slots) {
    if (ci.meals?.[s.id] === "yes" || (ci.meals?.[s.id] !== "no" && logged.has(s.id))) done++;
  }

  const wo = workoutFor(key);
  const trainingDue = !!wo;
  const trained = ci.trained === "yes" || sessionDoneSets(key) > 0;

  const total = slots.length + (trainingDue ? 1 : 0);
  const hit = done + (trainingDue && trained ? 1 : 0);
  return { done, planned: slots.length, trainingDue, trained, total, hit, pct: total ? hit / total : 0 };
}

/** A day counts as "kept" when four fifths of what was planned actually happened. */
export function dayKept(key) {
  return dayConsistency(key).pct >= 0.8;
}

export function consistencyStreak() {
  let n = 0;
  let key = todayKey();
  if (!dayKept(key)) key = addDays(key, -1);   // today is not lost until it ends
  while (dayKept(key)) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}

/** How many of the last `n` days were kept — the honest headline number. */
export function consistencyRate(n = 14) {
  let hit = 0, seen = 0;
  for (let i = 0; i < n; i++) {
    const key = addDays(todayKey(), -i);
    const c = dayConsistency(key);
    if (c.hit === 0 && !state.log[key] && !state.checkins[key]) continue;  // untouched day
    seen++;
    if (c.pct >= 0.8) hit++;
  }
  return { hit, seen, pct: seen ? hit / seen : 0 };
}

/* ── training ────────────────────────────────────────────── */

/** The session scheduled for a date, from the user's own editable week. */
export function workoutFor(key = todayKey()) {
  const day = state.program?.days?.[weekdayOf(key)];
  return day && day.ex && day.ex.length ? day : null;
}

export function setProgram(program) {
  update(d => { d.program = program; });
}

export function setProgramDay(weekday, day) {
  update(d => {
    if (!d.program.days) d.program.days = {};
    if (day) d.program.days[weekday] = day;
    else delete d.program.days[weekday];
  });
}

export function clearProgram() {
  update(d => { d.program = emptyProgram(); });
}

/**
 * When today's session actually happens. A one-off override wins over the day's
 * own time, which wins over the global default — so "I'm training at 9 today"
 * never rewrites the programme.
 */
export function sessionTimeFor(key = todayKey()) {
  if (state.sessionOverride?.[key]) return state.sessionOverride[key];
  const day = state.program?.days?.[weekdayOf(key)];
  return day?.time || state.settings.trainingTime || "17:00";
}

export function setSessionOverride(key, time) {
  update(d => {
    if (!d.sessionOverride) d.sessionOverride = {};
    if (time) d.sessionOverride[key] = time;
    else delete d.sessionOverride[key];
  });
}

/** Overrides for days already gone are noise — drop them on launch. */
export function pruneSessionOverrides() {
  const cutoff = addDays(todayKey(), -1);
  update(d => {
    for (const k of Object.keys(d.sessionOverride || {})) if (k < cutoff) delete d.sessionOverride[k];
  });
}

/* ── the session log ─────────────────────────────────────── */

const emptySet = () => ({ w: null, r: null, rpe: null, type: "work", done: false });

function ensureSession(draft, key) {
  if (!draft.lifts[key]) draft.lifts[key] = { ex: {}, startedAt: null, endedAt: null, note: "" };
  if (!draft.lifts[key].ex) draft.lifts[key].ex = {};
  return draft.lifts[key];
}

function ensureExercise(draft, key, exercise, count = 0) {
  const session = ensureSession(draft, key);
  if (!session.ex[exercise]) session.ex[exercise] = { sets: [], note: "" };
  const rec = session.ex[exercise];
  while (rec.sets.length < count) rec.sets.push(emptySet());
  return rec;
}

export function sessionFor(key) {
  return state.lifts[key] || { ex: {}, startedAt: null, endedAt: null, note: "" };
}

export function setsFor(key, exercise) {
  return state.lifts[key]?.ex?.[exercise]?.sets || [];
}

/** Write one field of one set. Filling weight and reps ticks it done for you. */
export function setLiftField(key, exercise, index, field, value) {
  update(d => {
    const rec = ensureExercise(d, key, exercise, index + 1);
    const set = rec.sets[index];
    if (field === "w" || field === "r" || field === "rpe") {
      set[field] = value === "" || value == null ? null : Number(value);
      // A set with both numbers in it has plainly been done; the tick stays
      // manual only for un-ticking, which is how you mark one as skipped.
      if (field !== "rpe" && set.w != null && set.r != null) set.done = true;
    } else {
      set[field] = value;
    }
    ensureSession(d, key);
    if (!d.lifts[key].startedAt) d.lifts[key].startedAt = Date.now();
  });
}

export function toggleSetDone(key, exercise, index) {
  update(d => {
    const rec = ensureExercise(d, key, exercise, index + 1);
    rec.sets[index].done = !rec.sets[index].done;
    if (!d.lifts[key].startedAt) d.lifts[key].startedAt = Date.now();
  });
}

export function setSetType(key, exercise, index, type) {
  update(d => {
    const rec = ensureExercise(d, key, exercise, index + 1);
    rec.sets[index].type = rec.sets[index].type === type ? "work" : type;
  });
}

export function addSet(key, exercise, type = "work") {
  update(d => {
    const rec = ensureExercise(d, key, exercise);
    rec.sets.push({ ...emptySet(), type });
  });
}

export function removeSet(key, exercise, index) {
  update(d => {
    const rec = d.lifts[key]?.ex?.[exercise];
    if (rec) rec.sets.splice(index, 1);
  });
}

export function setExerciseNote(key, exercise, note) {
  update(d => {
    ensureExercise(d, key, exercise).note = note;
  });
}

export function setSessionNote(key, note) {
  update(d => { ensureSession(d, key).note = note; });
}

export function startSession(key) {
  update(d => {
    const s = ensureSession(d, key);
    if (!s.startedAt) s.startedAt = Date.now();
    s.endedAt = null;
  });
}

export function endSession(key) {
  update(d => {
    const s = ensureSession(d, key);
    s.endedAt = Date.now();
  });
}

/** Sets that actually happened and count — warm-ups are excluded on purpose. */
export function workSets(key, exercise) {
  return setsFor(key, exercise).filter(s => s.type !== "warmup" && s.done && s.w != null && s.r != null);
}

export function sessionDoneSets(key) {
  const ex = state.lifts[key]?.ex || {};
  return Object.values(ex).reduce(
    (n, rec) => n + rec.sets.filter(s => s.done && s.type !== "warmup").length,
    0
  );
}

/** Most recent earlier day with real numbers logged for this exercise. */
export function lastSessionFor(exercise, beforeKey) {
  const keys = Object.keys(state.lifts).filter(k => k < beforeKey).sort().reverse();
  for (const k of keys) {
    const sets = state.lifts[k]?.ex?.[exercise]?.sets;
    if (sets && sets.some(s => s.w != null && s.type !== "warmup")) return { key: k, sets };
  }
  return null;
}

/** Every day this exercise was trained, oldest first. */
export function historyFor(exercise) {
  return Object.keys(state.lifts)
    .filter(k => (state.lifts[k]?.ex?.[exercise]?.sets || []).some(s => s.w != null && s.r != null && s.type !== "warmup"))
    .sort()
    .map(k => ({ key: k, sets: state.lifts[k].ex[exercise].sets.filter(s => s.type !== "warmup" && s.w != null && s.r != null) }));
}

/* ── settings & profile ──────────────────────────────────── */

export function addChallenge(ch) {
  update(d => d.challenges.push({ ...ch, id: uid() }));
}

export function deleteChallenge(id) {
  update(d => {
    d.challenges = d.challenges.filter(c => c.id !== id);
  });
}

export function setSetting(patch) {
  update(d => Object.assign(d.settings, patch));
}

export function setProfile(patch) {
  update(d => Object.assign(d.profile, patch));
}

/**
 * Finish onboarding: write the profile and lock in the targets. The meal
 * schedule and the training week both get sensible defaults the user can
 * rewrite at any time — onboarding never demands them.
 */
export function completeOnboarding(profile, targets, slots) {
  update(d => {
    Object.assign(d.profile, profile, {
      onboarded: true,
      startWeight: profile.weight,
      kcalTarget: targets.kcal,
      pTarget: targets.protein,
      cTarget: targets.carbs,
      fTarget: targets.fat,
      slots: slots || d.profile.slots,
      programStart: todayKey()
    });
  });
}

/** Skip the questions entirely — defaults now, real numbers whenever they want. */
export function skipOnboarding() {
  update(d => {
    d.profile.onboarded = true;
    d.profile.programStart = todayKey();
  });
}

export function nextMonday(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay(); // 0 = Sun
  const delta = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return dkey(d);
}

export function resetEverything() {
  state = structuredClone(DEFAULT_STATE);
  emit();
}

/* ── derived: streaks, weights ───────────────────────────── */

/** A day counts as hit when logged calories reach `ratio` of target. */
export function dayHit(key, ratio = 0.9) {
  const t = dayTotals(key);
  return t.kcal >= state.profile.kcalTarget * ratio;
}

export function currentStreak() {
  let n = 0;
  let key = todayKey();
  if (!dayHit(key)) key = addDays(key, -1);
  while (dayHit(key)) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}

export function weightSeries() {
  return Object.keys(state.log)
    .filter(k => state.log[k]?.weight != null)
    .sort()
    .map(k => ({ key: k, v: state.log[k].weight }));
}

export function rollingAvg(n, offset = 0) {
  const a = weightSeries();
  const end = a.length - offset;
  const slice = a.slice(Math.max(0, end - n), end);
  if (!slice.length) return null;
  return slice.reduce((s, x) => s + x.v, 0) / slice.length;
}

export function targetWeightAt(week) {
  const { startWeight, goalWeight } = state.profile;
  const rate = (goalWeight - startWeight) / 26;
  return startWeight + rate * Math.max(0, Math.min(26, week));
}

/* ── logging shortcuts: recent, frequent, favourite ──────── */

/**
 * What you actually eat, ranked by how often and how recently.
 *
 * Derived from the log rather than stored separately: the history is already the
 * source of truth, and a parallel "recents" list is one more thing to keep in
 * sync and get wrong. Scanning is cheap because it only ever looks at the last
 * few weeks — a two-year log does not make opening the add sheet slower.
 */
function scanRecentUse(days = 60) {
  const since = addDays(todayKey(), -days);
  const seen = new Map();
  for (const [key, day] of Object.entries(state.log)) {
    if (key < since) continue;
    for (const e of day.entries || []) {
      if (!e.ref) continue;
      const hit = seen.get(e.ref);
      if (hit) {
        hit.count++;
        if (key > hit.last) { hit.last = key; hit.amount = e.amount; hit.unit = e.unit; }
      } else {
        seen.set(e.ref, { ref: e.ref, kind: e.kind, count: 1, last: key, amount: e.amount, unit: e.unit });
      }
    }
  }
  return seen;
}

let useCache = null;
let useCacheStamp = null;

function recentUse() {
  const stamp = JSON.stringify([Object.keys(state.log).length, todayKey(), state.log[todayKey()]?.entries?.length]);
  if (useCache && useCacheStamp === stamp) return useCache;
  useCache = scanRecentUse();
  useCacheStamp = stamp;
  return useCache;
}

/** The foods and meals logged most recently, newest first. */
export function recentlyLogged(limit = 12) {
  return [...recentUse().values()]
    .sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : b.count - a.count))
    .slice(0, limit);
}

/** The foods and meals logged most often. */
export function frequentlyLogged(limit = 12) {
  return [...recentUse().values()]
    .filter(u => u.count >= 2)
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1))
    .slice(0, limit);
}

/**
 * The portion you used last time for this food. Defaulting the picker to it
 * removes a number-typing step from nearly every entry, because people eat the
 * same amount of the same things.
 */
export function lastPortionFor(foodId) {
  const hit = recentUse().get(foodId);
  if (!hit || hit.kind !== "food") return null;
  return { amount: hit.amount, unit: hit.unit };
}

export function isFavourite(kind, id) {
  return (state.favourites?.[kind === "meal" ? "meals" : "foods"] || []).includes(id);
}

export function toggleFavourite(kind, id) {
  const bucket = kind === "meal" ? "meals" : "foods";
  update(d => {
    if (!d.favourites) d.favourites = { foods: [], meals: [] };
    const list = d.favourites[bucket];
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.unshift(id);
  });
}

export function favouriteFoods() {
  return (state.favourites?.foods || []).map(id => getFood(id)).filter(Boolean);
}

export function favouriteMeals() {
  return (state.favourites?.meals || []).map(id => state.meals.find(m => m.id === id)).filter(Boolean);
}

/* ── editing and copying what's logged ───────────────────── */

/**
 * Change an existing entry in place. Re-derives the macros from the food when it
 * is still in the database, and falls back to scaling the snapshot when it is
 * not — an entry logged from a scanned barcode must stay editable after the
 * product has been forgotten.
 */
export function updateEntry(key, id, amount, unit) {
  update(d => {
    const day = d.log[key];
    if (!day) return;
    const e = day.entries.find(x => x.id === id);
    if (!e) return;

    const food = e.ref ? (d.customFoods.find(f => f.id === e.ref) || FOOD_BY_ID[e.ref]) : null;
    if (food && e.kind === "food") {
      const m = macrosFor(food, amount, unit);
      Object.assign(e, { amount, unit, grams: m.grams, kcal: m.kcal, p: m.p, c: m.c, f: m.f });
      return;
    }

    const ratio = e.amount > 0 ? amount / e.amount : 1;
    Object.assign(e, {
      amount, unit,
      kcal: e.kcal * ratio, p: e.p * ratio, c: e.c * ratio, f: e.f * ratio,
      grams: e.grams ? e.grams * ratio : e.grams
    });
  });
}

/** Move one logged entry to a different meal slot. */
export function moveEntry(key, id, slot) {
  update(d => {
    const e = d.log[key]?.entries.find(x => x.id === id);
    if (e) e.slot = slot;
  });
}

/**
 * Copy a whole day's food onto another day. Entries get fresh ids so the two
 * days can then be edited independently.
 */
export function copyDay(fromKey, toKey, { replace = false } = {}) {
  const source = state.log[fromKey]?.entries || [];
  if (!source.length) return 0;
  update(d => {
    const day = ensureDay(d, toKey);
    if (replace) day.entries = [];
    for (const e of source) day.entries.push({ ...structuredClone(e), id: uid() });
  });
  return source.length;
}

/** Copy the entries of one meal slot into another, on the same or a later day. */
export function copySlot(fromKey, fromSlot, toKey, toSlot) {
  const source = (state.log[fromKey]?.entries || []).filter(e => e.slot === fromSlot);
  if (!source.length) return 0;
  update(d => {
    const day = ensureDay(d, toKey);
    for (const e of source) day.entries.push({ ...structuredClone(e), id: uid(), slot: toSlot });
  });
  return source.length;
}

/** The most recent earlier day that has anything logged — what "yesterday" means. */
export function lastLoggedDayBefore(key) {
  return Object.keys(state.log)
    .filter(k => k < key && (state.log[k]?.entries?.length || 0) > 0)
    .sort()
    .pop() || null;
}

/* ── water ───────────────────────────────────────────────── */

export function dayWater(key) {
  return state.log[key]?.water || 0;
}

export function addWater(key, ml) {
  update(d => {
    const day = ensureDay(d, key);
    day.water = Math.max(0, (day.water || 0) + ml);
  });
}

export function setWater(key, ml) {
  update(d => {
    ensureDay(d, key).water = Math.max(0, Number(ml) || 0);
  });
}

/* ── nutrients beyond the macros ─────────────────────────── */

/**
 * Fibre, sugar, sodium, saturated fat and the micronutrients for one day.
 *
 * Two things make this more than a sum. First, a logged entry only snapshots the
 * four macros, so the nutrients are re-derived from the food it came from —
 * which is why an entry from a food that has since been deleted contributes
 * nothing. Second, and more importantly, coverage is reported alongside the
 * totals: the database has nutrient data for most whole foods and almost none of
 * the composite dishes, and "you ate 4 mg of iron" is a lie if half the day's
 * calories came from foods with no iron figure at all.
 */
export function dayNutrients(key) {
  const entries = dayEntries(key);
  const totals = Object.fromEntries(NUTRIENT_FIELDS.map(f => [f, null]));

  let knownKcal = 0;
  let totalKcal = 0;

  const add = row => {
    let any = false;
    for (const f of NUTRIENT_FIELDS) {
      if (row[f] == null) continue;
      totals[f] = (totals[f] || 0) + row[f];
      any = true;
    }
    return any;
  };

  for (const e of entries) {
    totalKcal += e.kcal;
    let contributed = false;

    if (e.kind === "food" && e.ref && e.grams) {
      const row = nutrientsForGrams(e.ref, e.grams);
      if (row) contributed = add(row);
    } else if (e.kind === "meal" && e.ref) {
      const meal = state.meals.find(m => m.id === e.ref);
      if (meal) {
        // The entry recorded portions; the recipe knows how much one portion is.
        const share = (e.amount || 1) / mealServings(meal);
        for (const it of meal.items || []) {
          const food = getFood(it.foodId);
          if (!food) continue;
          const grams = macrosFor(food, it.amount, it.unit).grams * share;
          const row = nutrientsForGrams(it.foodId, grams);
          if (row && add(row)) contributed = true;
        }
      }
    }

    if (contributed) knownKcal += e.kcal;
  }

  return {
    totals,
    knownKcal,
    totalKcal,
    coverage: totalKcal > 0 ? knownKcal / totalKcal : 0
  };
}

/** Nutrients for one saved recipe, per serving. */
export function mealNutrients(meal) {
  const totals = Object.fromEntries(NUTRIENT_FIELDS.map(f => [f, null]));
  const servings = mealServings(meal);
  let covered = 0;
  let count = 0;

  for (const it of meal.items || []) {
    const food = getFood(it.foodId);
    if (!food) continue;
    count++;
    const grams = macrosFor(food, it.amount, it.unit).grams / servings;
    const row = nutrientsForGrams(it.foodId, grams);
    if (!row) continue;
    let any = false;
    for (const f of NUTRIENT_FIELDS) {
      if (row[f] == null) continue;
      totals[f] = (totals[f] || 0) + row[f];
      any = true;
    }
    if (any) covered++;
  }

  return { totals, coverage: count ? covered / count : 0 };
}

/* ── the meal schedule ───────────────────────────────────── */

/**
 * How many meals a day, what they are called and when they happen, is not a
 * property of the app — it is a property of the person. Four meals suits one
 * person, six suits another, two suits someone eating in an eight-hour window.
 *
 * So slots are fully editable at any time, and every part of the app that talks
 * about "meals" reads this list rather than assuming a count.
 */

const MEAL_NAME_POOL = [
  "Breakfast", "Morning snack", "Lunch", "Afternoon snack",
  "Dinner", "Evening snack", "Late meal", "Pre-bed"
];

/** A sensible name for the nth meal of a day that has `total` of them. */
function suggestSlotName(index, total) {
  if (total <= 3) return ["Breakfast", "Lunch", "Dinner"][index] || `Meal ${index + 1}`;
  if (total === 4) return ["Breakfast", "Lunch", "Snack", "Dinner"][index] || `Meal ${index + 1}`;
  if (total === 5) return ["Breakfast", "Second breakfast", "Lunch", "Snack", "Dinner"][index] || `Meal ${index + 1}`;
  if (total === 6) return ["Breakfast", "Second breakfast", "Lunch", "Snack", "Dinner", "Late meal"][index] || `Meal ${index + 1}`;
  return MEAL_NAME_POOL[index] || `Meal ${index + 1}`;
}

export const toMinutes = t => {
  const [h, m] = String(t || "0:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fromMinutes = mins => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** Slots always read top-to-bottom in clock order — an unsorted day is confusing. */
function sortSlots(slots) {
  return [...slots].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

export function addSlot(name, time) {
  const id = `m_${uid()}`;
  update(d => {
    const slots = d.profile.slots;
    const last = sortSlots(slots)[slots.length - 1];
    const at = time || fromMinutes(toMinutes(last?.time || "08:00") + 180);
    slots.push({ id, name: name || suggestSlotName(slots.length, slots.length + 1), time: at });
    d.profile.slots = sortSlots(slots);
    d.profile.mealCount = d.profile.slots.length;
  });
  return id;
}

export function updateSlot(id, patch) {
  update(d => {
    const slot = d.profile.slots.find(s => s.id === id);
    if (!slot) return;
    Object.assign(slot, patch);
    if (patch.time) d.profile.slots = sortSlots(d.profile.slots);
  });
}

/**
 * Remove a slot. Anything already logged against it is moved to `moveTo` rather
 * than vanishing — silently dropping a day's calories because a slot was renamed
 * out of existence would be the worst kind of data loss: invisible.
 */
export function removeSlot(id, moveTo = null) {
  update(d => {
    if (d.profile.slots.length <= 1) return;
    const fallback = moveTo || d.profile.slots.find(s => s.id !== id)?.id;
    for (const day of Object.values(d.log)) {
      for (const e of day.entries || []) if (e.slot === id) e.slot = fallback;
    }
    for (const ci of Object.values(d.checkins)) {
      if (ci.meals && id in ci.meals) delete ci.meals[id];
    }
    d.profile.slots = d.profile.slots.filter(s => s.id !== id);
    d.profile.mealCount = d.profile.slots.length;
  });
}

/** How much food is logged against a slot, across the whole history. */
export function entriesInSlot(id) {
  let n = 0;
  for (const day of Object.values(state.log)) {
    for (const e of day.entries || []) if (e.slot === id) n++;
  }
  return n;
}

/**
 * Rebuild the whole schedule as `count` meals, evenly spread from `start`.
 * Existing logged food keeps its slot id where the slot survives, and is moved
 * to the nearest surviving slot where it does not.
 */
export function applyMealPreset(count, start = "08:30", gapHours = null) {
  const n = Math.max(1, Math.min(12, Math.round(count)));
  update(d => {
    const old = sortSlots(d.profile.slots);
    const startMin = toMinutes(start);
    // Spread across a 14-hour eating day unless a gap is given explicitly.
    const gap = gapHours != null ? gapHours * 60 : n > 1 ? Math.round((14 * 60) / (n - 1)) : 0;

    const next = Array.from({ length: n }, (_, i) => {
      const reuse = old[i];
      return {
        id: reuse?.id || `m_${uid()}`,
        name: reuse?.name || suggestSlotName(i, n),
        time: fromMinutes(startMin + i * gap)
      };
    });

    const surviving = new Set(next.map(s => s.id));
    const fallback = next[next.length - 1].id;
    for (const day of Object.values(d.log)) {
      for (const e of day.entries || []) if (!surviving.has(e.slot)) e.slot = fallback;
    }
    for (const ci of Object.values(d.checkins)) {
      if (!ci.meals) continue;
      for (const key of Object.keys(ci.meals)) if (!surviving.has(key)) delete ci.meals[key];
    }

    d.profile.slots = next;
    d.profile.mealCount = n;
  });
}

/** Spread the current slots evenly again, keeping their names. */
export function respaceSlots(start, gapHours) {
  update(d => {
    const startMin = toMinutes(start);
    const gap = gapHours * 60;
    d.profile.slots = sortSlots(d.profile.slots).map((s, i) => ({ ...s, time: fromMinutes(startMin + i * gap) }));
  });
}

/**
 * Entries pointing at a slot that no longer exists. Should always be empty —
 * this exists so the UI can surface them rather than lose them if it ever isn't.
 */
export function orphanEntries(key) {
  const ids = new Set(state.profile.slots.map(s => s.id));
  return dayEntries(key).filter(e => !ids.has(e.slot));
}

/* ── targets, per day ────────────────────────────────────── */

/**
 * The target for one specific day.
 *
 * With day-type targets off this is simply the profile's numbers. With them on,
 * training days get more carbohydrate and rest days get less, arranged so the
 * WEEK still totals exactly what it did before — you are moving calories around,
 * not adding them. Protein and fat hold steady, because neither has a good
 * reason to swing with training and protein least of all.
 */
export function targetsFor(key = todayKey()) {
  const p = state.profile;
  const base = { kcal: p.kcalTarget, p: p.pTarget, c: p.cTarget, f: p.fTarget, dayType: null, delta: 0 };
  if (!state.settings.dayTypeTargets) return base;

  const trainingDays = Object.keys(state.program?.days || {})
    .filter(d => state.program.days[d]?.ex?.length).length;
  if (trainingDays === 0 || trainingDays === 7) return base;

  const restDays = 7 - trainingDays;
  const swing = Math.min(0.4, Math.max(0.05, state.settings.dayTypeSwing || 0.15));
  const up = Math.round(p.kcalTarget * swing);
  // Whatever the training days gain, the rest days give back — the week nets out.
  const down = Math.round((up * trainingDays) / restDays);

  const isTraining = !!workoutFor(key);
  const delta = isTraining ? up : -down;
  const kcal = Math.max(1000, p.kcalTarget + delta);

  // Carbohydrate absorbs the whole swing.
  const carbs = Math.max(0, Math.round(p.cTarget + delta / 4));

  return {
    kcal,
    p: p.pTarget,
    c: carbs,
    f: p.fTarget,
    dayType: isTraining ? "training" : "rest",
    delta
  };
}

/** Monday-based week start for a date key. */
export function weekStart(key = todayKey()) {
  return addDays(key, -(weekdayOf(key) - 1));
}

/**
 * The week as one budget rather than seven pass/fail days.
 *
 * A short Tuesday can be repaid on Saturday; one heavy meal out does not ruin
 * anything. This is the framing that keeps people going, and it is also the more
 * accurate one — body composition responds to weekly averages, not daily ones.
 */
export function weekBudget(key = todayKey()) {
  const start = weekStart(key);
  const today = todayKey();

  let target = 0;
  let logged = 0;
  let daysElapsed = 0;
  let daysLeft = 0;
  const days = [];

  for (let i = 0; i < 7; i++) {
    const k = addDays(start, i);
    const t = targetsFor(k);
    target += t.kcal;
    const eaten = dayTotals(k).kcal;
    if (k < today) {
      logged += eaten;
      daysElapsed++;
    } else if (k === today) {
      logged += eaten;
      daysElapsed++;
      daysLeft++;                       // today still has room in it
    } else {
      daysLeft++;
    }
    days.push({ key: k, target: t.kcal, eaten, dayType: t.dayType, future: k > today });
  }

  const remaining = target - logged;
  const remainingDays = Math.max(1, daysLeft);

  return {
    start,
    target: Math.round(target),
    logged: Math.round(logged),
    remaining: Math.round(remaining),
    daysElapsed,
    daysLeft,
    perDay: Math.round(remaining / remainingDays),
    pace: target > 0 ? logged / target : 0,
    days
  };
}

/* ── the body itself ─────────────────────────────────────── */

/**
 * On a bulk the scale alone cannot tell you whether the gain is worth having.
 * Waist against arm is what does: both climbing means muscle and some fat, only
 * the waist climbing means the surplus is too big. So tape measurements are
 * first-class here, not an afterthought behind weight.
 */
export const MEASUREMENTS = [
  { key: "waist", label: "Waist", hint: "At the navel, relaxed, after breathing out. The number that tells you if the surplus is too big." },
  { key: "chest", label: "Chest", hint: "Around the widest point, arms down." },
  { key: "arm", label: "Arm", hint: "Mid-bicep, flexed or relaxed — just be consistent." },
  { key: "thigh", label: "Thigh", hint: "Mid-thigh, halfway between hip and knee." },
  { key: "hips", label: "Hips", hint: "Around the widest point of the glutes." },
  { key: "neck", label: "Neck", hint: "Just below the larynx." }
];

export function measurementsFor(key) {
  return state.measurements[key] || {};
}

export function setMeasurement(key, field, value) {
  update(d => {
    if (!d.measurements[key]) d.measurements[key] = {};
    const n = value === "" || value == null ? null : Number(value);
    if (n == null || Number.isNaN(n)) delete d.measurements[key][field];
    else d.measurements[key][field] = n;
    if (Object.keys(d.measurements[key]).length === 0) delete d.measurements[key];
  });
}

/** Every recorded value for one measurement, oldest first. */
export function measurementSeries(field) {
  return Object.keys(state.measurements)
    .filter(k => state.measurements[k][field] != null)
    .sort()
    .map(k => ({ key: k, v: state.measurements[k][field] }));
}

/** Latest value and the change since the first one, for a headline. */
export function measurementSummary(field) {
  const series = measurementSeries(field);
  if (!series.length) return null;
  const latest = series[series.length - 1];
  const first = series[0];
  return {
    latest: latest.v,
    at: latest.key,
    change: series.length > 1 ? Math.round((latest.v - first.v) * 10) / 10 : null,
    since: first.key,
    count: series.length
  };
}

/* ── progress photos ─────────────────────────────────────── */

export const PHOTO_ANGLES = [
  { key: "front", label: "Front" },
  { key: "side", label: "Side" },
  { key: "back", label: "Back" }
];

export function photosFor(key) {
  return state.photos[key] || {};
}

export function setProgressPhoto(key, angle, imageId) {
  update(d => {
    if (!d.photos[key]) d.photos[key] = {};
    if (imageId) d.photos[key][angle] = imageId;
    else delete d.photos[key][angle];
    if (Object.keys(d.photos[key]).length === 0) delete d.photos[key];
  });
}

/** Days that have at least one photo, newest first. */
export function photoDays() {
  return Object.keys(state.photos)
    .filter(k => Object.keys(state.photos[k]).length > 0)
    .sort()
    .reverse();
}

/** Every image id the app still points at — used to sweep orphaned files. */
export function allImageIds() {
  const ids = [];
  if (state.profile.photo) ids.push(state.profile.photo);
  for (const m of state.meals) if (m.photo) ids.push(m.photo);
  for (const day of Object.values(state.photos)) ids.push(...Object.values(day));
  return ids;
}
