/**
 * Languages.
 *
 * English, French and Arabic, because that is what Morocco actually reads. The
 * lookup falls back to English for any key a translation has not reached yet —
 * a missing string shows the English rather than a key name or an empty box,
 * which means translations can land incrementally without ever shipping a broken
 * screen.
 *
 * Arabic also switches the whole document to right-to-left. The stylesheet uses
 * logical properties where it matters, so that is one attribute rather than a
 * mirrored copy of every rule.
 */

import en from "../locales/en.js";
import fr from "../locales/fr.js";
import ar from "../locales/ar.js";

export const LOCALES = {
  en: { name: "English", native: "English", dir: "ltr", messages: en },
  fr: { name: "French", native: "Français", dir: "ltr", messages: fr },
  ar: { name: "Arabic", native: "العربية", dir: "rtl", messages: ar }
};

export const LOCALE_LIST = Object.entries(LOCALES).map(([code, l]) => ({ code, ...l }));

let current = "en";

/** Best guess from the device, used only until the user picks one. */
export function detectLocale() {
  try {
    const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const tag of tags) {
      const base = String(tag || "").toLowerCase().split("-")[0];
      if (LOCALES[base]) return base;
      // Darija is usually tagged ary; Arabic is the closer of the two we have.
      if (base === "ary") return "ar";
    }
  } catch {
    /* no navigator — fall through */
  }
  return "en";
}

export function setLocale(code) {
  current = LOCALES[code] ? code : "en";
  const root = document.documentElement;
  root.setAttribute("lang", current);
  root.setAttribute("dir", LOCALES[current].dir);
  return current;
}

export function getLocale() {
  return current;
}

export function isRTL() {
  return LOCALES[current].dir === "rtl";
}

/**
 * Translate a key, interpolating `{name}` placeholders.
 * Unknown keys fall back to English, then to the key itself.
 */
export function t(key, vars) {
  const msg = LOCALES[current]?.messages[key] ?? LOCALES.en.messages[key] ?? key;
  if (!vars) return msg;
  return String(msg).replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`));
}

/** Pick singular or plural. Arabic's fuller plural rules are overkill here. */
export function plural(n, singularKey, pluralKey, vars = {}) {
  return t(n === 1 ? singularKey : pluralKey, { ...vars, n });
}

/** Locale-aware date and number formatting, so 1,234 becomes ١٬٢٣٤ in Arabic. */
export function formatNumber(n, options) {
  try {
    return new Intl.NumberFormat(localeTag(), options).format(n);
  } catch {
    return String(n);
  }
}

export function formatDate(date, options) {
  try {
    return new Intl.DateTimeFormat(localeTag(), options).format(date);
  } catch {
    return String(date);
  }
}

function localeTag() {
  return current === "ar" ? "ar-MA" : current === "fr" ? "fr-MA" : "en-GB";
}

/** How complete each translation is, for an honest line in settings. */
export function coverage(code) {
  const total = Object.keys(LOCALES.en.messages).length;
  const done = Object.keys(LOCALES[code]?.messages || {}).filter(k => LOCALES[code].messages[k]).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
