/**
 * The bridge to the native full-screen alarms.
 *
 * Capacitor's notification plugin cannot take over a locked screen — that needs
 * Android's `fullScreenIntent`, which it does not expose. The native plugin in
 * `android/app/src/main/java/com/chouaib/bulkclock/` does, and this is the web
 * side of it.
 *
 * Two layers of reminder, deliberately different in character:
 *
 *   • Thirty minutes ahead — an ordinary heads-up notification with Ate it /
 *     Snooze / Skipped buttons. Answerable from the shade, easy to ignore.
 *   • At the moment itself — a real alarm. Its own sound per kind, and it takes
 *     over the screen even with the phone locked in a pocket.
 *
 * Alarms are one-shot, so this arms the next few days' worth and re-arms every
 * time the app opens. A reboot is covered natively by BootReceiver.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import { todayKey, addDays, parseKey, weekdayOf, sessionTimeFor, toMinutes } from "./store.js";

const Alarm = registerPlugin("FullScreenAlarm");

/** How many days ahead to arm, so a week of not opening the app still works. */
export const DAYS_AHEAD = 3;

/* Id ranges, kept apart from the LocalNotifications ids entirely. */
const MEAL_BASE = 11000;      // 11000 + dayOffset * 20 + slotIndex
const MEAL_TOP = 11099;
const TRAIN_BASE = 12000;     // 12000 + dayOffset
const TRAIN_TOP = 12099;

export const isNative = () => Capacitor.isNativePlatform();

const available = () => isNative() && Capacitor.isPluginAvailable("FullScreenAlarm");

/** True when the device can actually do the full-screen takeover. */
export async function permissions() {
  if (!available()) {
    return { supported: false, exactAlarms: false, fullScreen: false, batteryUnrestricted: false };
  }
  try {
    const p = await Alarm.status();
    return { supported: true, ...p };
  } catch {
    return { supported: false, exactAlarms: false, fullScreen: false, batteryUnrestricted: false };
  }
}

export async function openExactAlarmSettings() {
  if (available()) await Alarm.openExactAlarmSettings().catch(() => {});
}

export async function openFullScreenSettings() {
  if (available()) await Alarm.openFullScreenSettings().catch(() => {});
}

export async function openBatterySettings() {
  if (available()) await Alarm.openBatterySettings().catch(() => {});
}

/** Fire one in a few seconds so the whole path can be tested on a real phone. */
export async function testAlarm(kind = "meal", seconds = 10) {
  if (!available()) return false;
  try {
    await Alarm.test({ kind, seconds });
    return true;
  } catch {
    return false;
  }
}

/**
 * Which reminder opened the app, if one did. Returns null when the app was
 * opened by hand, so the takeover can show that specific event rather than
 * re-deriving it from the clock.
 */
export async function consumePending() {
  if (!available()) return null;
  try {
    const r = await Alarm.consumePending();
    return r?.event ? { event: r.event, kind: r.kind } : null;
  } catch {
    return null;
  }
}

/* ── arming ──────────────────────────────────────────────── */

function atOn(dateKey, time) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const mins = toMinutes(time);
  return new Date(y, m - 1, d, Math.floor(mins / 60), mins % 60, 0, 0).getTime();
}

/**
 * Rebuild the full-screen alarm set from the current schedule.
 *
 * Everything is cancelled first rather than diffed: the schedule is small, the
 * cancel is cheap, and a diff that gets it wrong leaves a reminder firing for a
 * meal that no longer exists.
 */
export async function rearm(state) {
  if (!available()) return { ok: false, count: 0, reason: "unsupported" };

  const s = state.settings;
  if (!s.fullScreenReminders) {
    await Alarm.cancelRange({ from: MEAL_BASE, to: MEAL_TOP }).catch(() => {});
    await Alarm.cancelRange({ from: TRAIN_BASE, to: TRAIN_TOP }).catch(() => {});
    return { ok: true, count: 0, reason: "disabled" };
  }

  try {
    await Alarm.cancelRange({ from: MEAL_BASE, to: MEAL_TOP });
    await Alarm.cancelRange({ from: TRAIN_BASE, to: TRAIN_TOP });
  } catch {
    /* nothing armed yet */
  }

  const now = Date.now();
  const today = todayKey();
  let count = 0;

  for (let day = 0; day < DAYS_AHEAD; day++) {
    const key = addDays(today, day);

    if (s.notifyMeals) {
      state.profile.slots.slice(0, 20).forEach((slot, i) => {
        const at = atOn(key, slot.time);
        if (at <= now) return;

        // A meal already answered today should not wake the phone for it.
        if (day === 0 && answeredMeal(state, key, slot.id)) return;

        count++;
        Alarm.schedule({
          id: MEAL_BASE + day * 20 + i,
          at: String(at),
          title: slot.name,
          body: `Time to eat. Tap to log it, or answer from here.`,
          kind: "meal",
          event: `meal:${slot.id}`
        }).catch(() => {});
      });
    }

    if (s.notifyTraining) {
      const wd = weekdayOf(key);
      const session = state.program?.days?.[wd];
      if (session?.ex?.length) {
        const time = day === 0 ? sessionTimeFor(key) : session.time || s.trainingTime;
        const at = atOn(key, time);
        if (at > now && !(day === 0 && answeredTraining(state, key))) {
          count++;
          Alarm.schedule({
            id: TRAIN_BASE + day,
            at: String(at),
            title: session.name,
            body: `${session.ex.length} movements. Time to train.`,
            kind: "training",
            event: "session"
          }).catch(() => {});
        }
      }
    }
  }

  return { ok: true, count, reason: null };
}

function answeredMeal(state, key, slotId) {
  const answer = state.checkins?.[key]?.meals?.[slotId];
  if (answer === "yes" || answer === "no") return true;
  return (state.log[key]?.entries || []).some(e => e.slot === slotId);
}

function answeredTraining(state, key) {
  const answer = state.checkins?.[key]?.trained;
  if (answer === "yes" || answer === "no") return true;
  return Object.values(state.lifts?.[key]?.ex || {})
    .some(rec => (rec.sets || []).some(x => x.done && x.type !== "warmup"));
}
