/**
 * Real photos for the foods worth photographing.
 *
 * The app is offline-first: nothing here is required for it to work. A photo is
 * a progressive enhancement layered over the gradient tile in foodVisual.js.
 *
 * Resolution goes through Wikipedia's pageimages API against a CURATED title
 * map — never a blind search — so a food either gets the right picture or none.
 * Results (including misses) are cached in localStorage, so each food costs at
 * most one request ever, and the cache keeps working with the radio off.
 */

const CACHE_KEY = "bulkclock.photos.v1";
const ENDPOINT = "https://en.wikipedia.org/w/api.php";

/** Food-name keyword → Wikipedia article title. Longest match wins. */
const TITLES = {
  "chicken breast": "Chicken as food", "chicken thigh": "Chicken as food",
  "chicken leg": "Chicken as food", "chicken mince": "Ground meat", chicken: "Chicken as food",
  "turkey breast": "Turkey meat", "turkey mince": "Ground meat", turkey: "Turkey meat",
  "beef mince": "Ground beef", "beef steak": "Steak", "beef liver": "Liver (food)",
  beef: "Beef", veal: "Veal", "lamb chop": "Meat chop", "lamb leg": "Lamb and mutton",
  lamb: "Lamb and mutton", rabbit: "Rabbit meat", liver: "Liver (food)",
  merguez: "Merguez", kefta: "Kofta", sausage: "Sausage", bacon: "Bacon",

  sardine: "Sardine", tuna: "Tuna", cod: "Cod", hake: "Hake", whiting: "Whiting (fish)",
  sole: "Sole (fish)", salmon: "Salmon as food", mackerel: "Mackerel", anchov: "Anchovy",
  shrimp: "Shrimp", squid: "Squid as food", mussel: "Mussel", octopus: "Octopus as food",
  crab: "Crab", oyster: "Oyster",

  "egg white": "Egg white", "egg yolk": "Egg yolk", omelette: "Omelette", egg: "Egg as food",
  milk: "Milk", yogurt: "Yogurt", yoghurt: "Yogurt", raib: "Yogurt", lben: "Buttermilk",
  cheese: "Cheese", jben: "Cheese", butter: "Butter", cream: "Cream", labneh: "Strained yogurt",

  "brown rice": "Brown rice", rice: "Rice", couscous: "Couscous", pasta: "Pasta",
  spaghetti: "Spaghetti", oat: "Oatmeal", quinoa: "Quinoa", bulgur: "Bulgur",
  barley: "Barley", semolina: "Semolina", bread: "Bread", khobz: "Khobz",
  batbout: "Batbout", msemen: "Msemen", meloui: "Msemen", harcha: "Harcha",
  baghrir: "Baghrir", pita: "Pita", tortilla: "Tortilla", croissant: "Croissant",
  cracker: "Cracker (food)", flour: "Flour",

  lentil: "Lentil", chickpea: "Chickpea", "fava": "Vicia faba", "broad bean": "Vicia faba",
  "white bean": "Phaseolus vulgaris", bean: "Bean", hummus: "Hummus", bissara: "Bissara",
  loubia: "Bean",

  banana: "Banana", apple: "Apple", pear: "Pear", orange: "Orange (fruit)",
  clementine: "Clementine", mandarin: "Mandarin orange", lemon: "Lemon", grape: "Grape",
  raisin: "Raisin", strawberr: "Strawberry", cherr: "Cherry", peach: "Peach",
  apricot: "Apricot", watermelon: "Watermelon", melon: "Melon", pineapple: "Pineapple",
  mango: "Mango", kiwi: "Kiwifruit", avocado: "Avocado", coconut: "Coconut",
  fig: "Common fig", date: "Date palm", pomegranate: "Pomegranate", plum: "Plum",
  prune: "Prune", persimmon: "Persimmon", blueberr: "Blueberry",

  tomato: "Tomato", cucumber: "Cucumber", carrot: "Carrot", "bell pepper": "Bell pepper",
  pepper: "Bell pepper", chili: "Chili pepper", onion: "Onion", garlic: "Garlic",
  "sweet potato": "Sweet potato", potato: "Potato", aubergine: "Eggplant",
  eggplant: "Eggplant", courgette: "Zucchini", zucchini: "Zucchini", broccoli: "Broccoli",
  cauliflower: "Cauliflower", cabbage: "Cabbage", lettuce: "Lettuce", spinach: "Spinach",
  chard: "Chard", mushroom: "Edible mushroom", corn: "Maize", pea: "Pea", olive: "Olive",
  beetroot: "Beetroot", pumpkin: "Pumpkin", turnip: "Turnip", radish: "Radish",
  celery: "Celery", leek: "Leek", artichoke: "Artichoke", asparagus: "Asparagus",

  almond: "Almond", walnut: "Walnut", cashew: "Cashew", peanut: "Peanut",
  pistachio: "Pistachio", hazelnut: "Hazelnut", "pumpkin seed": "Pumpkin seed",
  "sunflower seed": "Sunflower seed", sesame: "Sesame", chia: "Chia seed",
  flax: "Flax", tahini: "Tahini", amlou: "Amlou",

  "olive oil": "Olive oil", "argan": "Argan oil", oil: "Cooking oil", smen: "Smen",
  ghee: "Ghee", mayonnaise: "Mayonnaise",

  tagine: "Tajine", tajine: "Tajine", tanjia: "Tanjia", harira: "Harira", chorba: "Chorba",
  rfissa: "Rfissa", pastilla: "Pastilla", briouat: "Briouat", zaalouk: "Zaalouk",
  taktouka: "Taktouka", bakoula: "Bakoula", seffa: "Seffa", sfenj: "Sfenj",
  chebakia: "Chebakia", ghriba: "Ghoriba", "corne de gazelle": "Kaab el ghazal",
  msemmen: "Msemen", soup: "Soup",

  chocolate: "Chocolate", cocoa: "Cocoa solids", honey: "Honey", jam: "Fruit preserves",
  cake: "Cake", donut: "Doughnut", "ice cream": "Ice cream", popcorn: "Popcorn",
  fries: "French fries", crisp: "Potato chip", sugar: "Sugar",

  water: "Water", tea: "Tea", coffee: "Coffee", juice: "Juice", cola: "Cola",
  soda: "Soft drink",

  whey: "Whey protein", casein: "Casein", creatine: "Creatine", "protein powder": "Bodybuilding supplement"
};

const KEYS = Object.keys(TITLES).sort((a, b) => b.length - a.length);

/** The Wikipedia article for a food, or null when we would only be guessing. */
export function titleFor(food) {
  if (food.photo) return null;           // explicit URL already on the record
  const n = (food.name || "").toLowerCase();
  for (const k of KEYS) if (n.includes(k)) return TITLES[k];
  return null;
}

/* ── cache ───────────────────────────────────────────── */

let cache = null;
function readCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    cache = {};
  }
  return cache;
}

let flushTimer = null;
function writeCache() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* quota — the tiles still render */
    }
  }, 400);
}

export function clearPhotoCache() {
  cache = {};
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch { /* ignore */ }
}

export function cachedPhoto(title) {
  const hit = readCache()[title];
  return hit && hit !== "0" ? hit : null;
}

/* ── fetching ────────────────────────────────────────── */

const inflight = new Map();
const listeners = new Set();

/** Subscribe to "a new photo landed" so mounted avatars can re-render. */
export function onPhoto(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Resolve one article's lead image. Batches nothing — Wikipedia is happy with
 * a handful of requests and each title is fetched at most once per install.
 */
export function fetchPhoto(title, size = 320) {
  const c = readCache();
  if (title in c) return Promise.resolve(c[title] === "0" ? null : c[title]);
  if (inflight.has(title)) return inflight.get(title);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve(null);

  const url =
    `${ENDPOINT}?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail` +
    `&pithumbsize=${size}&redirects=1&titles=${encodeURIComponent(title)}`;

  const p = fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      const pages = data?.query?.pages || {};
      const first = Object.values(pages)[0];
      const src = first?.thumbnail?.source || null;
      cache[title] = src || "0";     // "0" is a negative hit: never ask again
      writeCache();
      listeners.forEach(fn => fn(title, src));
      return src;
    })
    .catch(() => null)               // offline or blocked — tile stays
    .finally(() => inflight.delete(title));

  inflight.set(title, p);
  return p;
}
