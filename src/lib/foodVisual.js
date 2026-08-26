/**
 * Visual identity for every food in the database.
 *
 * Two layers, in this order:
 *   1. A gradient tile + glyph, derived from the food's name and category.
 *      Always available, costs nothing, works in airplane mode.
 *   2. A real photo, fetched lazily over the network (see photos.js) and
 *      cross-faded on top of the tile when it arrives.
 *
 * Layer 1 is the contract — the list never renders an empty square.
 */

/** Category → [gradient start, gradient end, fallback glyph]. */
export const CATEGORY_LOOK = {
  "Meat & poultry":  ["#7f1d1d", "#b91c1c", "🍗"],
  "Fish & seafood":  ["#0c4a6e", "#0284c7", "🐟"],
  "Eggs & dairy":    ["#78350f", "#d97706", "🥚"],
  "Grains & bread":  ["#713f12", "#ca8a04", "🍞"],
  "Vegetables":      ["#14532d", "#16a34a", "🥦"],
  "Fruit":           ["#7c2d12", "#ea580c", "🍎"],
  "Legumes":         ["#3f2d0e", "#a16207", "🫘"],
  "Nuts & seeds":    ["#44280c", "#92400e", "🥜"],
  "Fats & oils":     ["#3f3f0a", "#a3a30c", "🫒"],
  "Sweets & snacks": ["#4a1d5c", "#9333ea", "🍫"],
  "Drinks":          ["#0f3d4a", "#0891b2", "🥤"],
  "Supplements":     ["#1e3a5f", "#2563eb", "💊"],
  "Moroccan":        ["#7c2d12", "#c2410c", "🥘"],
  "Scanned":         ["#27272a", "#52525b", "🏷️"],
  "My foods":        ["#365314", "#84cc16", "🍽️"]
};

const FALLBACK = ["#27272a", "#52525b", "🍽️"];

/**
 * Name keyword → glyph. Longest match wins, so "chicken liver" beats "chicken".
 * Ordered roughly by specificity; the lookup sorts by length anyway.
 */
const GLYPHS = {
  banana: "🍌", apple: "🍎", pear: "🍐", orange: "🍊", clementine: "🍊", mandarin: "🍊",
  tangerine: "🍊", lemon: "🍋", lime: "🍋", grape: "🍇", raisin: "🍇", strawberr: "🍓",
  cherr: "🍒", peach: "🍑", apricot: "🍑", nectarine: "🍑", melon: "🍈", watermelon: "🍉",
  pineapple: "🍍", mango: "🥭", kiwi: "🥝", avocado: "🥑", coconut: "🥥", fig: "🫐",
  date: "🌴", pomegranate: "🫐", blueberr: "🫐", plum: "🫐", prune: "🫐", persimmon: "🍅",

  tomato: "🍅", cucumber: "🥒", pickle: "🥒", carrot: "🥕", pepper: "🫑", chili: "🌶️",
  harissa: "🌶️", onion: "🧅", garlic: "🧄", potato: "🥔", "sweet potato": "🍠",
  aubergine: "🍆", eggplant: "🍆", courgette: "🥒", zucchini: "🥒", broccoli: "🥦",
  cauliflower: "🥦", cabbage: "🥬", lettuce: "🥬", spinach: "🥬", chard: "🥬", kale: "🥬",
  mushroom: "🍄", corn: "🌽", pea: "🫛", olive: "🫒", beet: "🫐", pumpkin: "🎃",
  squash: "🎃", turnip: "🥔", radish: "🥔", celery: "🥬", leek: "🥬", artichoke: "🥬",
  asparagus: "🥬", "mixed veg": "🥗", salad: "🥗",

  chicken: "🍗", turkey: "🦃", duck: "🦆", beef: "🥩", steak: "🥩", veal: "🥩",
  lamb: "🍖", mutton: "🍖", pork: "🥓", bacon: "🥓", sausage: "🌭", merguez: "🌭",
  kefta: "🍢", skewer: "🍢", brochette: "🍢", liver: "🥩", heart: "🥩", tripe: "🥩",
  rabbit: "🍖", mince: "🥩", camel: "🍖",

  fish: "🐟", tuna: "🐟", sardine: "🐟", cod: "🐟", hake: "🐟", whiting: "🐟",
  sole: "🐟", salmon: "🍣", mackerel: "🐟", anchov: "🐟", shrimp: "🍤", prawn: "🍤",
  squid: "🦑", calamari: "🦑", octopus: "🐙", mussel: "🦪", clam: "🦪", oyster: "🦪",
  crab: "🦀",

  egg: "🥚", omelette: "🍳", milk: "🥛", yogurt: "🥣", yoghurt: "🥣", raib: "🥣",
  lben: "🥛", cheese: "🧀", jben: "🧀", butter: "🧈", smen: "🧈", cream: "🍦",
  labneh: "🥣",

  bread: "🍞", khobz: "🍞", batbout: "🍞", msemen: "🥞", meloui: "🥞", harcha: "🥞",
  baghrir: "🥞", pancake: "🥞", pita: "🫓", tortilla: "🫓", wrap: "🌯", toast: "🍞",
  rice: "🍚", couscous: "🍚", pasta: "🍝", spaghetti: "🍝", noodle: "🍜", oat: "🥣",
  porridge: "🥣", cereal: "🥣", muesli: "🥣", granola: "🥣", flour: "🌾", semolina: "🌾",
  quinoa: "🌾", bulgur: "🌾", barley: "🌾", cracker: "🍘", biscuit: "🍪", cookie: "🍪",
  croissant: "🥐",

  lentil: "🫘", chickpea: "🫘", bean: "🫘", fava: "🫘", broad: "🫘", pea_split: "🫘",
  hummus: "🥣", bissara: "🥣", loubia: "🫘",

  almond: "🌰", walnut: "🌰", cashew: "🌰", peanut: "🥜", pistachio: "🥜",
  hazelnut: "🌰", "pumpkin seed": "🎃", "sunflower seed": "🌻", "sesame": "🌰",
  chia: "🌱", flax: "🌱", "seed": "🌱", "nut butter": "🥜", tahini: "🥣", amlou: "🥣",

  oil: "🫗", olive_oil: "🫒", argan: "🫗", ghee: "🧈", mayonnaise: "🥫",

  tagine: "🥘", tajine: "🥘", "tanjia": "🥘", harira: "🍲", soup: "🍲", chorba: "🍲",
  rfissa: "🥘", pastilla: "🥧", briouat: "🥟", zaalouk: "🥗", taktouka: "🥗",
  bakoula: "🥬", seffa: "🍚", "sfenj": "🍩", chebakia: "🍯", ghriba: "🍪",
  kaab: "🍪", mhancha: "🥧", "corne de gazelle": "🍪",

  chocolate: "🍫", cocoa: "🍫", candy: "🍬", sweet: "🍬", sugar: "🧂", honey: "🍯",
  jam: "🍯", cake: "🍰", pastry: "🥐", donut: "🍩", ice: "🍦", crisp: "🍟",
  chips: "🍟", fries: "🍟", popcorn: "🍿", nutella: "🍫",

  water: "💧", tea: "🍵", "thé": "🍵", coffee: "☕", juice: "🧃", soda: "🥤",
  cola: "🥤", smoothie: "🥤", beer: "🍺", wine: "🍷",

  whey: "🥤", protein: "💪", creatine: "💊", vitamin: "💊", omega: "💊", casein: "🥤",
  salt: "🧂", spice: "🌿", herb: "🌿", parsley: "🌿", coriander: "🌿", mint: "🌿",
  cumin: "🌿", saffron: "🌿", ginger: "🫚"
};

const KEYS = Object.keys(GLYPHS).sort((a, b) => b.length - a.length);

/** Stable 0–1 hash of a string, used to vary the gradient angle per food. */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function glyphFor(food) {
  const n = food.name.toLowerCase();
  for (const k of KEYS) {
    if (n.includes(k.replace(/_/g, " ")) || n.includes(k)) return GLYPHS[k];
  }
  return (CATEGORY_LOOK[food.cat] || FALLBACK)[2];
}

export function tileFor(food) {
  const [a, b] = CATEGORY_LOOK[food.cat] || FALLBACK;
  const angle = 120 + (hash(food.id) % 5) * 20;
  return {
    glyph: glyphFor(food),
    background: `linear-gradient(${angle}deg, ${a}, ${b})`
  };
}
