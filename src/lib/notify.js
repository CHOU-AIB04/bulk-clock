import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/**
 * Every reminder is scheduled on the device, so they fire with no network and no
 * server. Rescheduling cancels our own IDs first, so the set never accumulates.
 *
 * Two things make this more than a set of alarms:
 *
 *   1. Everything fires TWICE — once a configurable lead time ahead (30 minutes
 *      by default), and once at the moment itself. The lead notification is the
 *      one that actually changes behaviour: being told about lunch at lunchtime
 *      is information, being told half an hour earlier is a chance to act.
 *   2. Every reminder carries actions, so "Ate it" and "Skipped" can be answered
 *      from the shade without opening the app. A reminder you can answer in one
 *      tap is a reminder that stays switched on.
 *
 * ID ranges keep the groups separable and cancellable:
 *   100–119  meal, at the time        130–149  meal, lead
 *   200–206  training, at the time    210–216  training, lead
 *   220–226  rest days
 *   240 weigh-in   241 check-in   242/243 today's moved session   250–252 water
 */
const MEAL_BASE = 100;
const MEAL_LEAD = 130;
const TRAIN_BASE = 200;
const TRAIN_LEAD = 210;
const REST_BASE = 220;
const WEIGH_ID = 240;
const CHECKIN_ID = 241;
const TODAY_SESSION = 242;
const TODAY_SESSION_LEAD = 243;
const WATER_BASE = 250;
const SUPP_BASE = 260;

const ALL_OWNED = [
  ...Array.from({ length: 20 }, (_, i) => MEAL_BASE + i),
  ...Array.from({ length: 20 }, (_, i) => MEAL_LEAD + i),
  ...Array.from({ length: 7 }, (_, i) => TRAIN_BASE + i),
  ...Array.from({ length: 7 }, (_, i) => TRAIN_LEAD + i),
  ...Array.from({ length: 7 }, (_, i) => REST_BASE + i),
  WEIGH_ID, CHECKIN_ID, TODAY_SESSION, TODAY_SESSION_LEAD,
  ...Array.from({ length: 3 }, (_, i) => WATER_BASE + i),
  ...Array.from({ length: 20 }, (_, i) => SUPP_BASE + i)
];

/**
 * The app stores 1 = Monday … 7 = Sunday; Capacitor counts 1 = Sunday … 7 = Saturday.
 */
const toCapWeekday = d => (d % 7) + 1;

export const isNative = () => Capacitor.isNativePlatform();

export async function ensurePermission() {
  if (!isNative()) return false;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") perm = await LocalNotifications.requestPermissions();
    return perm.display === "granted";
  } catch {
    return false;
  }
}

function hm(t) {
  const [hour, minute] = String(t).split(":").map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

/** Shift a HH:MM time backwards by n minutes, wrapping across midnight. */
function minus(t, mins) {
  const [h, m] = String(t).split(":").map(Number);
  const total = ((h || 0) * 60 + (m || 0) - mins + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

function trainingDays(state) {
  return Object.keys(state.program?.days || {})
    .map(Number)
    .filter(d => state.program.days[d]?.ex?.length)
    .sort();
}

/* ── actions the user can take from the shade ────────────── */

const ACTION_TYPES = [
  {
    id: "MEAL",
    actions: [
      { id: "ate", title: "Ate it" },
      { id: "snooze", title: "Snooze" },
      { id: "skip", title: "Skipped", destructive: true }
    ]
  },
  {
    id: "SESSION",
    actions: [
      { id: "trained", title: "Trained" },
      { id: "snooze", title: "Snooze" },
      { id: "skip", title: "Skipped", destructive: true }
    ]
  },
  {
    id: "CHECKIN",
    actions: [{ id: "open", title: "Open check-in" }]
  }
];

let actionsRegistered = false;
async function registerActions() {
  if (!isNative() || actionsRegistered) return;
  try {
    await LocalNotifications.registerActionTypes({ types: ACTION_TYPES });
    actionsRegistered = true;
  } catch {
    /* older platform — notifications still fire, just without buttons */
  }
}

/* ── tap and action handling ─────────────────────────────── */

const tapListeners = new Set();
let listenerAttached = false;

/**
 * Subscribe to "the user did something with a notification". Used by the app
 * shell to re-check whether a full-screen reminder should be shown.
 */
export function onNotificationTap(fn) {
  tapListeners.add(fn);
  attachListener();
  return () => tapListeners.delete(fn);
}

async function attachListener() {
  if (!isNative() || listenerAttached) return;
  listenerAttached = true;
  try {
    await LocalNotifications.addListener("localNotificationActionPerformed", async event => {
      const { actionId, notification } = event || {};
      const extra = notification?.extra || {};
      // Imported lazily: notify.js is loaded by the store's own consumers, and a
      // static import back into the store would be a cycle.
      const store = await import("./store.js");
      const key = store.todayKey();

      if (extra.kind === "meal" && extra.slotId) {
        if (actionId === "ate") store.setMealCheck(key, extra.slotId, "yes");
        if (actionId === "skip") store.setMealCheck(key, extra.slotId, "no");
        if (actionId === "snooze") {
          store.snoozeReminder(key, `meal:${extra.slotId}`, store.getState().settings.snoozeMinutes || 15);
        }
      }

      if (extra.kind === "session") {
        if (actionId === "trained") store.setTrainedCheck(key, "yes");
        if (actionId === "skip") store.setTrainedCheck(key, "no");
        if (actionId === "snooze") {
          store.snoozeReminder(key, "session", store.getState().settings.snoozeMinutes || 15);
        }
      }

      tapListeners.forEach(fn => { try { fn(event); } catch { /* one listener must not break the rest */ } });
    });
  } catch {
    listenerAttached = false;
  }
}

/* ── scheduling ──────────────────────────────────────────── */

/**
 * Rebuild the whole reminder set from current settings.
 * Returns { ok, count, reason } so the UI can say what actually happened.
 */
export async function rescheduleAll(state) {
  if (!isNative()) return { ok: false, count: 0, reason: "web" };

  const granted = await ensurePermission();
  if (!granted) return { ok: false, count: 0, reason: "denied" };

  await registerActions();
  await attachListener();

  const { slots } = state.profile;
  const s = state.settings;
  const lead = Math.max(0, s.leadMinutes ?? 30);

  try {
    const pending = await LocalNotifications.getPending();
    const toCancel = pending.notifications.filter(n => ALL_OWNED.includes(n.id));
    if (toCancel.length) await LocalNotifications.cancel({ notifications: toCancel });
  } catch {
    /* nothing pending yet */
  }

  const notifications = [];
  const base = {
    smallIcon: "ic_stat_icon",
    autoCancel: true,
    ongoing: false
  };

  if (s.notifyMeals) {
    slots.slice(0, 20).forEach((slot, i) => {
      const extra = { kind: "meal", slotId: slot.id };

      if (lead > 0) {
        notifications.push({
          ...base,
          id: MEAL_LEAD + i,
          title: `${slot.name} in ${lead} minutes`,
          body: `Due at ${slot.time}. Tap to log it now, or answer from here.`,
          schedule: { on: minus(slot.time, lead), allowWhileIdle: true },
          channelId: "meals",
          actionTypeId: "MEAL",
          extra
        });
      }

      notifications.push({
        ...base,
        id: MEAL_BASE + i,
        title: `${slot.name} — now`,
        body: `Meal ${i + 1} of ${slots.length}. Open Bulk Clock to log it.`,
        schedule: { on: hm(slot.time), allowWhileIdle: true },
        channelId: "meals",
        actionTypeId: "MEAL",
        extra
      });
    });
  }

  const training = trainingDays(state);

  if (s.notifyTraining) {
    training.forEach((day, i) => {
      const session = state.program.days[day];
      const time = session.time || s.trainingTime;
      const extra = { kind: "session", weekday: day };

      if (lead > 0) {
        notifications.push({
          ...base,
          id: TRAIN_LEAD + i,
          title: `${session.name} in ${lead} minutes`,
          body: `${session.ex.length} movements, starting ${time}. Time to get moving.`,
          schedule: { on: { weekday: toCapWeekday(day), ...minus(time, lead) }, allowWhileIdle: true },
          channelId: "training",
          actionTypeId: "SESSION",
          extra
        });
      }

      notifications.push({
        ...base,
        id: TRAIN_BASE + i,
        title: `${session.name} — ${time}`,
        body: "Log every set. Add weight only once you hit the top of the rep range on all sets.",
        schedule: { on: { weekday: toCapWeekday(day), ...hm(time) }, allowWhileIdle: true },
        channelId: "training",
        actionTypeId: "SESSION",
        extra
      });
    });
  }

  if (s.notifyRestDay) {
    [1, 2, 3, 4, 5, 6, 7].filter(d => !training.includes(d)).forEach((day, i) => {
      notifications.push({
        ...base,
        id: REST_BASE + i,
        title: "Rest day",
        body: "No session today. Eat the full target anyway — recovery is where the muscle gets built.",
        schedule: { on: { weekday: toCapWeekday(day), hour: 9, minute: 0 }, allowWhileIdle: true },
        channelId: "training"
      });
    });
  }

  if (s.notifyWater) {
    ["11:00", "15:00", "19:00"].forEach((t, i) => {
      notifications.push({
        ...base,
        id: WATER_BASE + i,
        title: "Water",
        body: `Aiming for ${(s.waterTargetMl / 1000).toFixed(1)} L today. Top up if you're behind.`,
        schedule: { on: hm(t), allowWhileIdle: true },
        channelId: "water"
      });
    });
  }

  if (s.notifySupplements !== false && (state.supplements || []).length) {
    // Supplements repeat weekly per day, so a supplement limited to certain days
    // becomes one notification per day rather than one daily repeat.
    let slot = 0;
    for (const sup of state.supplements) {
      const days = sup.days || [1, 2, 3, 4, 5, 6, 7];
      for (const day of days) {
        if (slot >= 20) break;
        notifications.push({
          ...base,
          id: SUPP_BASE + slot++,
          title: sup.name,
          body: sup.dose ? `${sup.dose} ${sup.unit}. Tap to tick it off.` : "Tap to tick it off.",
          schedule: { on: { weekday: toCapWeekday(day), ...hm(sup.time) }, allowWhileIdle: true },
          channelId: "supplements",
          extra: { kind: "supplement", supplementId: sup.id }
        });
      }
    }
  }

  if (s.notifyCheckin) {
    notifications.push({
      ...base,
      id: CHECKIN_ID,
      title: "How did today go?",
      body: "Tick off the meals you actually ate and whether you trained. Takes ten seconds.",
      schedule: { on: hm(s.checkinTime), allowWhileIdle: true },
      channelId: "checkin",
      actionTypeId: "CHECKIN",
      extra: { kind: "checkin" }
    });
  }

  if (s.notifyWeighIn && s.trackWeight) {
    notifications.push({
      ...base,
      id: WEIGH_ID,
      title: "Weigh in",
      body: "Morning, after the bathroom, before eating. Same conditions every day.",
      schedule: { on: hm(s.weighInTime), allowWhileIdle: true },
      channelId: "weigh"
    });
  }

  if (!notifications.length) return { ok: true, count: 0, reason: "none-enabled" };

  try {
    await createChannels();
    await LocalNotifications.schedule({ notifications });
    return { ok: true, count: notifications.length, reason: null };
  } catch (e) {
    return { ok: false, count: 0, reason: String(e?.message || e) };
  }
}

/**
 * Reschedule today's session reminders after the session has been moved.
 *
 * The weekly repeating reminders still cover every other week, so these are
 * one-shots at exact timestamps that simply land first. A time already past is
 * cancelled rather than fired late.
 */
export async function scheduleTodaySession(state, dateKey) {
  if (!isNative()) return false;
  if (!(await ensurePermission())) return false;

  const wd = (() => {
    const [y, m, d] = dateKey.split("-").map(Number);
    const day = new Date(y, m - 1, d).getDay();
    return day === 0 ? 7 : day;
  })();

  const session = state.program?.days?.[wd];
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: TODAY_SESSION }, { id: TODAY_SESSION_LEAD }]
    });
  } catch {
    /* nothing pending */
  }
  if (!session?.ex?.length) return false;

  const time = state.sessionOverride?.[dateKey] || session.time || state.settings.trainingTime;
  const lead = Math.max(0, state.settings.leadMinutes ?? 30);
  const [hour, minute] = String(time).split(":").map(Number);
  const [y, m, d] = dateKey.split("-").map(Number);
  const at = new Date(y, m - 1, d, hour || 0, minute || 0, 0, 0);
  const leadAt = new Date(at.getTime() - lead * 60000);

  const out = [];
  const extra = { kind: "session", weekday: wd };

  if (leadAt.getTime() > Date.now() && lead > 0) {
    out.push({
      id: TODAY_SESSION_LEAD,
      title: `${session.name} in ${lead} minutes`,
      body: `Moved to ${time} for today.`,
      schedule: { at: leadAt, allowWhileIdle: true },
      smallIcon: "ic_stat_icon",
      channelId: "training",
      actionTypeId: "SESSION",
      extra
    });
  }
  if (at.getTime() > Date.now()) {
    out.push({
      id: TODAY_SESSION,
      title: `${session.name} at ${time}`,
      body: "Moved for today. Log every set as you go.",
      schedule: { at, allowWhileIdle: true },
      smallIcon: "ic_stat_icon",
      channelId: "training",
      actionTypeId: "SESSION",
      extra
    });
  }
  if (!out.length) return false;

  try {
    await createChannels();
    await registerActions();
    await LocalNotifications.schedule({ notifications: out });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop reminding someone about a meal they have already eaten.
 *
 * The weekly reminders repeat, so they cannot simply be deleted — instead the
 * ones for today that are already answered are cancelled and re-scheduled for
 * the same time NEXT week. The result is the same alarm every week, minus the
 * ones that would arrive after the fact today.
 *
 * This runs on launch and after anything is logged, which is exactly when the
 * app knows something has been dealt with.
 */
export async function suppressDoneToday(state) {
  if (!isNative()) return 0;

  const key = todayKeyLocal();
  const entries = state.log[key]?.entries || [];
  const logged = new Set(entries.map(e => e.slot));
  const ci = state.checkins?.[key] || { meals: {} };

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const lead = Math.max(0, state.settings.leadMinutes ?? 30);

  const cancel = [];
  state.profile.slots.slice(0, 20).forEach((slot, i) => {
    const answered = ci.meals?.[slot.id] === "yes" || ci.meals?.[slot.id] === "no" || logged.has(slot.id);
    if (!answered) return;
    const [h, m] = String(slot.time).split(":").map(Number);
    const at = (h || 0) * 60 + (m || 0);
    // Only worth cancelling the ones that have not already fired.
    if (at - lead > nowMin) cancel.push({ id: MEAL_LEAD + i });
    if (at > nowMin) cancel.push({ id: MEAL_BASE + i });
  });

  const trainedToday = Object.values(state.lifts?.[key]?.ex || {})
    .some(rec => (rec.sets || []).some(x => x.done && x.type !== "warmup"));
  if (ci.trained === "yes" || ci.trained === "no" || trainedToday) {
    cancel.push({ id: TODAY_SESSION }, { id: TODAY_SESSION_LEAD });
  }

  if (!cancel.length) return 0;
  try {
    await LocalNotifications.cancel({ notifications: cancel });
    return cancel.length;
  } catch {
    return 0;
  }
}

/** Local date key, duplicated here so notify.js never imports the store at module load. */
function todayKeyLocal() {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Importance 5 is what makes Android show a reminder as a heads-up card over
 * whatever is on screen rather than a silent line in the shade. Water and
 * weigh-ins sit lower deliberately — they are not worth interrupting for.
 */
async function createChannels() {
  if (Capacitor.getPlatform() !== "android") return;
  const channels = [
    { id: "meals", name: "Meal reminders", description: "Before and at each meal in your schedule", importance: 5, visibility: 1, vibration: true },
    { id: "training", name: "Training sessions", description: "Before and at each session in your programme", importance: 5, visibility: 1, vibration: true },
    { id: "checkin", name: "Daily check-in", description: "The evening review of what actually happened", importance: 4, visibility: 1, vibration: true },
    { id: "weigh", name: "Weigh-in", description: "Optional morning weigh-in", importance: 3, visibility: 1 },
    { id: "water", name: "Water", description: "Nudges if you're behind on water", importance: 3, visibility: 1 },
    { id: "supplements", name: "Supplements", description: "Creatine, vitamins and anything else on your list", importance: 4, visibility: 1 }
  ];
  for (const c of channels) {
    try {
      await LocalNotifications.createChannel(c);
    } catch {
      /* channel already exists — Android keeps the user's own settings for it */
    }
  }
}

export async function cancelAll() {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch {
    /* nothing to cancel */
  }
}

export async function pendingCount() {
  if (!isNative()) return 0;
  try {
    const pending = await LocalNotifications.getPending();
    return pending.notifications.length;
  } catch {
    return 0;
  }
}

/** Fires ~10 seconds out so the user can confirm notifications actually work. */
export async function testNotification() {
  if (!isNative()) return false;
  if (!(await ensurePermission())) return false;
  await createChannels();
  await registerActions();
  await LocalNotifications.schedule({
    notifications: [{
      id: 999,
      title: "Lunch in 30 minutes",
      body: "This is what a reminder looks like. Answer it from here, or tap to open the app.",
      schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true },
      smallIcon: "ic_stat_icon",
      channelId: "meals",
      actionTypeId: "MEAL",
      extra: { kind: "test" }
    }]
  });
  return true;
}
