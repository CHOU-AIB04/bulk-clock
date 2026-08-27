/**
 * What the app should be interrupting you about, right now.
 *
 * Everything on this screen is derived from the same three sources the rest of
 * the app uses — your meal slots, your training week, your check-in settings —
 * so there is no second schedule to drift out of sync.
 *
 * Two rules keep it from becoming noise:
 *   1. An event that has already happened never fires. A meal you logged, or a
 *      session whose sets are in, is silently dropped.
 *   2. An event only stays live for a window after its time. A lunch reminder at
 *      six in the evening is not a reminder, it's an accusation.
 */

import {
  getState, todayKey, dayEntries, checkinFor, workoutFor,
  sessionTimeFor, sessionDoneSets, reminderStateFor, toMinutes
} from "./store.js";

/** How long after its time an event stays worth interrupting for. */
export const LIVE_WINDOW_MIN = 90;

function atMinutes(mins, now = new Date()) {
  const d = new Date(now);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

/**
 * Every event today, with the time it happens and whether it has been dealt
 * with. Ordered by time.
 */
export function todaysEvents(now = new Date()) {
  const s = getState();
  const key = todayKey();
  const entries = dayEntries(key);
  const logged = new Set(entries.map(e => e.slot));
  const ci = checkinFor(key);
  const events = [];

  for (const slot of s.profile.slots) {
    const answered = ci.meals?.[slot.id];
    events.push({
      id: `meal:${slot.id}`,
      kind: "meal",
      slot,
      title: slot.name,
      time: slot.time,
      minutes: toMinutes(slot.time),
      at: atMinutes(toMinutes(slot.time), now),
      done: answered === "yes" || answered === "no" || logged.has(slot.id)
    });
  }

  const wo = workoutFor(key);
  if (wo) {
    const time = sessionTimeFor(key);
    events.push({
      id: "session",
      kind: "session",
      workout: wo,
      title: wo.name,
      time,
      minutes: toMinutes(time),
      at: atMinutes(toMinutes(time), now),
      done: ci.trained === "yes" || ci.trained === "no" || sessionDoneSets(key) > 0
    });
  }

  if (s.settings.notifyCheckin) {
    const time = s.settings.checkinTime || "21:30";
    const allAnswered = s.profile.slots.every(sl => ci.meals?.[sl.id]) && (!wo || ci.trained);
    events.push({
      id: "checkin",
      kind: "checkin",
      title: "Daily check-in",
      time,
      minutes: toMinutes(time),
      at: atMinutes(toMinutes(time), now),
      done: allAnswered
    });
  }

  return events.sort((a, b) => a.minutes - b.minutes);
}

/**
 * The one event worth taking over the screen for, or null.
 *
 * The check-in is never given the full screen — it is a review, not a deadline,
 * and taking over someone's phone at 21:30 to ask how their day went is the
 * behaviour that gets an app's notifications switched off.
 */
export function dueEvent(now = new Date()) {
  const s = getState();
  if (!s.settings.fullScreenReminders) return null;

  const key = todayKey();
  const lead = Math.max(0, s.settings.leadMinutes ?? 30);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const candidates = todaysEvents(now).filter(e => {
    if (e.done || e.kind === "checkin") return false;
    if (nowMin < e.minutes - lead) return false;
    if (nowMin > e.minutes + LIVE_WINDOW_MIN) return false;

    const rs = reminderStateFor(key, e.id);
    if (rs?.dismissed) return false;
    if (rs?.snoozedUntil && Date.now() < rs.snoozedUntil) return false;
    return true;
  });

  if (!candidates.length) return null;

  // The most imminent one wins; a meal that is already late beats one due soon.
  candidates.sort((a, b) => {
    const aLate = nowMin - a.minutes;
    const bLate = nowMin - b.minutes;
    if (aLate >= 0 && bLate < 0) return -1;
    if (bLate >= 0 && aLate < 0) return 1;
    return Math.abs(a.minutes - nowMin) - Math.abs(b.minutes - nowMin);
  });

  const e = candidates[0];
  const deltaMin = e.minutes - nowMin;
  return { ...e, deltaMin, late: deltaMin < 0 };
}

/** A human phrase for how far away something is. */
export function relativeTime(deltaMin) {
  const abs = Math.abs(deltaMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = h > 0 ? `${h} h ${m ? `${m} min` : ""}`.trim() : `${m} min`;
  if (deltaMin > 0) return `in ${span}`;
  if (deltaMin === 0) return "now";
  return `${span} ago`;
}
