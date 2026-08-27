/**
 * Metric and imperial.
 *
 * The app stores everything in metric — kilograms, centimetres, grams,
 * millilitres — and converts only at the moment of display or input. Storing
 * whatever the user last had selected would mean a unit switch silently
 * rewriting years of data, and a rounding error compounding every time they
 * changed their mind.
 *
 * Food portions stay in grams in both systems on purpose: every nutrition label
 * in the world is per 100 g, and "6.3 oz of rice" is a number nobody can weigh.
 */

import { getState } from "./store.js";

export const KG_TO_LB = 2.20462;
export const CM_TO_IN = 0.393701;
export const ML_TO_FLOZ = 0.033814;

export function isImperial() {
  return getState().settings.units === "imperial";
}

const round = (n, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/* ── body weight ─────────────────────────────────────────── */

export const weightUnit = () => (isImperial() ? "lb" : "kg");

/** Stored kilograms → the number to show. */
export function toDisplayWeight(kg, dp = 1) {
  if (kg == null) return null;
  return round(isImperial() ? kg * KG_TO_LB : kg, dp);
}

/** A number the user typed → kilograms to store. */
export function fromDisplayWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return isImperial() ? n / KG_TO_LB : n;
}

export function formatWeight(kg, dp = 1) {
  if (kg == null) return "—";
  return `${toDisplayWeight(kg, dp)} ${weightUnit()}`;
}

/* ── lengths ─────────────────────────────────────────────── */

export const lengthUnit = () => (isImperial() ? "in" : "cm");

export function toDisplayLength(cm, dp = 1) {
  if (cm == null) return null;
  return round(isImperial() ? cm * CM_TO_IN : cm, dp);
}

export function fromDisplayLength(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return isImperial() ? n / CM_TO_IN : n;
}

export function formatLength(cm, dp = 1) {
  if (cm == null) return "—";
  return `${toDisplayLength(cm, dp)} ${lengthUnit()}`;
}

/** Height reads better as feet and inches than as a decimal number of inches. */
export function formatHeight(cm) {
  if (cm == null) return "—";
  if (!isImperial()) return `${Math.round(cm)} cm`;
  const totalIn = cm * CM_TO_IN;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return inch === 12 ? `${ft + 1}′ 0″` : `${ft}′ ${inch}″`;
}

/* ── volume ──────────────────────────────────────────────── */

export const volumeUnit = () => (isImperial() ? "fl oz" : "L");

export function formatVolume(ml) {
  if (ml == null) return "—";
  return isImperial()
    ? `${Math.round(ml * ML_TO_FLOZ)} fl oz`
    : `${(ml / 1000).toFixed(1)} L`;
}

/* ── loads on the bar ────────────────────────────────────── */

/**
 * Barbell loads are the one place imperial users genuinely think in pounds, so
 * lifting numbers convert too — but the stored value stays in kilograms, and the
 * plate calculator swaps its plate set rather than converting kilo plates.
 */
export function formatLoad(kg, dp = 1) {
  if (kg == null) return "—";
  return `${round(isImperial() ? kg * KG_TO_LB : kg, dp)} ${weightUnit()}`;
}

export const LB_PLATES = [45, 35, 25, 10, 5, 2.5];
export const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export function plateSet() {
  return isImperial() ? LB_PLATES : KG_PLATES;
}
