/** Meal-slot defaults, starter recipes, the exercise library and training templates. */

export const DEFAULT_SLOTS = [
  { id: "m1", name: "Breakfast", time: "08:30" },
  { id: "m2", name: "Lunch", time: "13:00" },
  { id: "m3", name: "Snack", time: "16:30" },
  { id: "m4", name: "Dinner", time: "20:00" }
];

/**
 * Starter recipes. These are OPT-IN — `meals` starts empty and the user taps
 * "Load starter meals" on the Diet tab if they want them. Nothing is forced.
 */
export const SEED_MEALS = [
  {
    id: "seed_first_breakfast",
    name: "Yogurt bowl",
    items: [
      { foodId: "yogurt_greek", amount: 125, unit: "g" },
      { foodId: "milk_whole", amount: 150, unit: "g" },
      { foodId: "banana", amount: 1, unit: "small" },
      { foodId: "dates", amount: 3, unit: "tbsp chopped" },
      { foodId: "pumpkin_seeds", amount: 10, unit: "g" },
      { foodId: "raisins", amount: 10, unit: "g" }
    ]
  },
  {
    id: "seed_breakfast_two",
    name: "Eggs & bread",
    items: [
      { foodId: "egg_whole", amount: 3, unit: "large" },
      { foodId: "pita", amount: 100, unit: "g" },
      { foodId: "olive_oil", amount: 1, unit: "tsp" },
      { foodId: "tomato", amount: 60, unit: "g" },
      { foodId: "cucumber", amount: 40, unit: "g" }
    ]
  },
  {
    id: "seed_lunch_mince",
    name: "Rice plate — lean mince",
    items: [
      { foodId: "rice_brown_raw", amount: 80, unit: "g" },
      { foodId: "turkey_mince", amount: 120, unit: "g" },
      { foodId: "olive_oil", amount: 1, unit: "tsp" },
      { foodId: "onion", amount: 38, unit: "g" },
      { foodId: "mixed_veg", amount: 150, unit: "g" }
    ]
  },
  {
    id: "seed_lunch_chicken",
    name: "Rice plate — chicken breast",
    items: [
      { foodId: "rice_brown_raw", amount: 80, unit: "g" },
      { foodId: "chicken_breast", amount: 100, unit: "g" },
      { foodId: "olive_oil", amount: 1, unit: "tsp" },
      { foodId: "onion", amount: 38, unit: "g" },
      { foodId: "mixed_veg", amount: 150, unit: "g" }
    ]
  },
  {
    id: "seed_lunch_tuna",
    name: "Rice plate — tuna",
    items: [
      { foodId: "rice_brown_raw", amount: 80, unit: "g" },
      { foodId: "tuna_water", amount: 110, unit: "g" },
      { foodId: "olive_oil", amount: 1, unit: "tsp" },
      { foodId: "onion", amount: 38, unit: "g" },
      { foodId: "mixed_veg", amount: 150, unit: "g" }
    ]
  },
  {
    id: "seed_oats",
    name: "Overnight oats",
    items: [
      { foodId: "oats_dry", amount: 30, unit: "g" },
      { foodId: "yogurt_greek", amount: 125, unit: "g" },
      { foodId: "milk_whole", amount: 100, unit: "g" },
      { foodId: "banana", amount: 1, unit: "small" },
      { foodId: "chia_seeds", amount: 10, unit: "g" },
      { foodId: "pumpkin_seeds", amount: 10, unit: "g" },
      { foodId: "dates", amount: 2, unit: "tbsp chopped" },
      { foodId: "raisins", amount: 7, unit: "g" }
    ]
  }
];

/* ── exercise library ────────────────────────────────────── */

/** name|muscle|equipment — searchable when building a training day. */
const EX_RAW = `
Barbell bench press|Chest|Barbell
Incline barbell press|Chest|Barbell
Dumbbell bench press|Chest|Dumbbell
Incline dumbbell press|Chest|Dumbbell
Machine chest press|Chest|Machine
Cable fly|Chest|Cable
Pec deck|Chest|Machine
Push-up|Chest|Bodyweight
Dip|Chest|Bodyweight
Barbell row, bent over|Back|Barbell
Pendlay row|Back|Barbell
Chest-supported row|Back|Machine
Seated cable row|Back|Cable
One-arm dumbbell row|Back|Dumbbell
Pull-up|Back|Bodyweight
Chin-up|Back|Bodyweight
Lat pulldown|Back|Cable
Wide-grip lat pulldown|Back|Cable
Straight-arm pulldown|Back|Cable
T-bar row|Back|Barbell
Standing overhead press|Shoulders|Barbell
Seated dumbbell press|Shoulders|Dumbbell
Arnold press|Shoulders|Dumbbell
Dumbbell lateral raise|Shoulders|Dumbbell
Cable lateral raise|Shoulders|Cable
Rear-delt fly|Shoulders|Dumbbell
Cable face pull|Shoulders|Cable
Upright row|Shoulders|Barbell
Barbell curl|Arms|Barbell
EZ-bar curl|Arms|Barbell
Dumbbell curl|Arms|Dumbbell
Hammer curl|Arms|Dumbbell
Incline dumbbell curl|Arms|Dumbbell
Preacher curl|Arms|Machine
Cable curl|Arms|Cable
Rope triceps pushdown|Arms|Cable
Triceps pushdown, bar|Arms|Cable
Skull crusher|Arms|Barbell
Overhead triceps extension|Arms|Dumbbell
Close-grip bench press|Arms|Barbell
Back squat|Legs|Barbell
Front squat|Legs|Barbell
Hack squat|Legs|Machine
Leg press|Legs|Machine
Bulgarian split squat|Legs|Dumbbell
Walking lunge|Legs|Dumbbell
Goblet squat|Legs|Dumbbell
Leg extension|Legs|Machine
Conventional deadlift|Legs|Barbell
Sumo deadlift|Legs|Barbell
Romanian deadlift|Legs|Barbell
Lying leg curl|Legs|Machine
Seated leg curl|Legs|Machine
Hip thrust|Legs|Barbell
Glute bridge|Legs|Bodyweight
Standing calf raise|Legs|Machine
Seated calf raise|Legs|Machine
Hanging leg raise|Core|Bodyweight
Cable crunch|Core|Cable
Ab wheel rollout|Core|Bodyweight
Plank|Core|Bodyweight
Russian twist|Core|Bodyweight
Back extension|Core|Bodyweight
Farmer's walk|Core|Dumbbell
Treadmill incline walk|Cardio|Machine
Stationary bike|Cardio|Machine
Rowing machine|Cardio|Machine
Jump rope|Cardio|Bodyweight
Burpee|Cardio|Bodyweight
`;

export const EXERCISES = EX_RAW.trim().split("\n").map(line => {
  const [name, muscle, equipment] = line.split("|");
  return { name, muscle, equipment };
});

export const MUSCLES = [...new Set(EXERCISES.map(e => e.muscle))];

export function searchExercises(query, muscle) {
  const q = query.trim().toLowerCase();
  return EXERCISES.filter(e => {
    if (muscle && muscle !== "All" && e.muscle !== muscle) return false;
    return !q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q);
  }).slice(0, 60);
}

/* ── training week ───────────────────────────────────────── */

const ex = (name, sets, reps) => ({ name, sets, reps });

export function emptyProgram(name = "My programme") {
  return { name, days: {} };
}

/**
 * Bundled splits. None of these is mandatory — they load into the editable
 * week, and every day, exercise, set count and rep range stays editable after.
 */
const RAW_TEMPLATES = [
  {
    id: "upper_lower_4",
    name: "Upper / Lower — 4 days",
    desc: "Two heavy days, two volume days. The best strength-per-hour split for most people.",
    days: {
      1: { name: "Upper — heavy", ex: [
        ex("Barbell bench press", 4, "5–6"),
        ex("Barbell row, bent over", 4, "6–8"),
        ex("Standing overhead press", 3, "6–8"),
        ex("Pull-up", 3, "8–10"),
        ex("Incline dumbbell press", 3, "8–10"),
        ex("Cable face pull", 3, "12–15"),
        ex("Barbell curl", 3, "8–10")
      ] },
      2: { name: "Lower — heavy", ex: [
        ex("Back squat", 4, "5–6"),
        ex("Romanian deadlift", 3, "8–10"),
        ex("Leg press", 3, "10–12"),
        ex("Lying leg curl", 3, "10–12"),
        ex("Standing calf raise", 4, "10–12"),
        ex("Hanging leg raise", 3, "10–15")
      ] },
      4: { name: "Upper — volume", ex: [
        ex("Incline barbell press", 4, "8–10"),
        ex("Chest-supported row", 4, "8–10"),
        ex("Seated dumbbell press", 3, "10–12"),
        ex("Wide-grip lat pulldown", 3, "10–12"),
        ex("Cable fly", 3, "12–15"),
        ex("Dumbbell lateral raise", 3, "12–15"),
        ex("Rope triceps pushdown", 3, "10–12"),
        ex("Hammer curl", 3, "10–12")
      ] },
      5: { name: "Lower — volume", ex: [
        ex("Conventional deadlift", 3, "5"),
        ex("Hack squat", 3, "8–10"),
        ex("Bulgarian split squat", 3, "8–10 ea"),
        ex("Leg extension", 3, "12–15"),
        ex("Seated calf raise", 4, "12–15"),
        ex("Cable crunch", 3, "10–15")
      ] }
    }
  },
  {
    id: "ppl_6",
    name: "Push / Pull / Legs — 6 days",
    desc: "Highest volume split here. Only worth running if you recover well and eat enough.",
    days: {
      1: { name: "Push", ex: [
        ex("Barbell bench press", 4, "6–8"),
        ex("Seated dumbbell press", 3, "8–10"),
        ex("Incline dumbbell press", 3, "10–12"),
        ex("Dumbbell lateral raise", 4, "12–15"),
        ex("Rope triceps pushdown", 3, "10–12"),
        ex("Overhead triceps extension", 3, "12–15")
      ] },
      2: { name: "Pull", ex: [
        ex("Pull-up", 4, "6–10"),
        ex("Barbell row, bent over", 4, "8–10"),
        ex("Seated cable row", 3, "10–12"),
        ex("Cable face pull", 3, "15"),
        ex("Barbell curl", 3, "8–10"),
        ex("Hammer curl", 3, "12")
      ] },
      3: { name: "Legs", ex: [
        ex("Back squat", 4, "6–8"),
        ex("Romanian deadlift", 3, "8–10"),
        ex("Leg press", 3, "12"),
        ex("Lying leg curl", 3, "12"),
        ex("Standing calf raise", 4, "12–15")
      ] },
      4: { name: "Push", ex: [
        ex("Incline barbell press", 4, "8–10"),
        ex("Machine chest press", 3, "10–12"),
        ex("Cable lateral raise", 4, "15"),
        ex("Dip", 3, "8–12"),
        ex("Close-grip bench press", 3, "8–10")
      ] },
      5: { name: "Pull", ex: [
        ex("Lat pulldown", 4, "10–12"),
        ex("Chest-supported row", 4, "10–12"),
        ex("Straight-arm pulldown", 3, "12–15"),
        ex("Rear-delt fly", 3, "15"),
        ex("EZ-bar curl", 3, "10–12")
      ] },
      6: { name: "Legs", ex: [
        ex("Front squat", 4, "8"),
        ex("Hip thrust", 3, "10–12"),
        ex("Bulgarian split squat", 3, "10 ea"),
        ex("Leg extension", 3, "15"),
        ex("Seated calf raise", 4, "15")
      ] }
    }
  },
  {
    id: "fullbody_3",
    name: "Full body — 3 days",
    desc: "Everything, three times a week. The most forgiving option if your week is unpredictable.",
    days: {
      1: { name: "Full body A", ex: [
        ex("Back squat", 3, "6–8"),
        ex("Barbell bench press", 3, "6–8"),
        ex("Barbell row, bent over", 3, "8–10"),
        ex("Seated dumbbell press", 2, "10–12"),
        ex("Lying leg curl", 2, "12"),
        ex("Plank", 3, "45 s")
      ] },
      3: { name: "Full body B", ex: [
        ex("Romanian deadlift", 3, "6–8"),
        ex("Incline dumbbell press", 3, "8–10"),
        ex("Lat pulldown", 3, "10–12"),
        ex("Leg press", 3, "12"),
        ex("Dumbbell lateral raise", 3, "15"),
        ex("Cable crunch", 3, "12")
      ] },
      5: { name: "Full body C", ex: [
        ex("Conventional deadlift", 3, "5"),
        ex("Dumbbell bench press", 3, "10"),
        ex("Chin-up", 3, "6–10"),
        ex("Bulgarian split squat", 3, "10 ea"),
        ex("Cable face pull", 3, "15"),
        ex("Standing calf raise", 3, "15")
      ] }
    }
  },
  {
    id: "home_bodyweight",
    name: "Home — no equipment",
    desc: "Bodyweight only, three days a week. For weeks you cannot get to a gym.",
    days: {
      1: { name: "Push & core", ex: [
        ex("Push-up", 4, "10–20"),
        ex("Dip", 3, "8–15"),
        ex("Plank", 3, "45–60 s"),
        ex("Russian twist", 3, "20"),
        ex("Burpee", 3, "10")
      ] },
      3: { name: "Legs", ex: [
        ex("Goblet squat", 4, "15"),
        ex("Walking lunge", 3, "12 ea"),
        ex("Glute bridge", 3, "15–20"),
        ex("Standing calf raise", 4, "20")
      ] },
      5: { name: "Pull & conditioning", ex: [
        ex("Pull-up", 4, "5–10"),
        ex("Back extension", 3, "15"),
        ex("Jump rope", 4, "60 s"),
        ex("Hanging leg raise", 3, "10–15")
      ] }
    }
  }
];

/**
 * Every training day carries its own clock time, because people do not train at
 * the same hour every day. A day without one falls back to the default session
 * time in settings.
 */
function withTimes(days, time = "17:00") {
  const out = {};
  for (const [wd, day] of Object.entries(days)) out[wd] = { time, ...day };
  return out;
}

export const TEMPLATES = RAW_TEMPLATES.map(t => ({ ...t, days: withTimes(t.days) }));

/** The week a fresh install starts with. Fully editable from the Training tab. */
export const DEFAULT_PROGRAM = {
  name: TEMPLATES[0].name,
  days: TEMPLATES[0].days
};

/** Kept so the older insight rules keep resolving; the app reads `state.program`. */
export const WORKOUTS = DEFAULT_PROGRAM.days;

export const PHASES = [
  { a: 1, b: 4, n: "Adaptation", d: "Leave 3–4 reps in reserve. You are re-learning the lifts and letting tendons catch up. Do not chase weight yet." },
  { a: 5, b: 12, n: "Accumulation", d: "Drop to 1–2 reps in reserve and run double progression hard. Most of the size gets built here." },
  { a: 13, b: 13, n: "Deload", d: "Same weights, half the sets. Keep eating the full target." },
  { a: 14, b: 21, n: "Intensification", d: "Heavier top sets, 1 rep in reserve on compounds. Main-lift rep ranges drop by about two." },
  { a: 22, b: 22, n: "Deload", d: "Second deload. Re-measure your waist and re-shoot progress photos." },
  { a: 23, b: 26, n: "Consolidate", d: "Test where your lifts landed, hold what you gained, decide whether to run another block." }
];

export const BLOCK_WEEKS = 26;

export function phaseForWeek(w) {
  return PHASES.find(p => w >= p.a && w <= p.b) || null;
}
