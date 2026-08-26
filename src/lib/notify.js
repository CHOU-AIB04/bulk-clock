import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/**
 * All reminders are scheduled on the device, so they fire with no network and no
 * server. Rescheduling cancels our own IDs first, so the set never accumulates.
 *
 * ID ranges keep the groups separable:
 *   100–199  meal slots
 *   200–209  training sessions
 *   210–219  rest days
 *   220–229  weigh-in
 *   230–239  evening check-in
 *   240      today's one-off session, when it has been moved
 */
const MEAL_BASE = 100;
const TRAIN_BASE = 200;
const REST_BASE = 210;
const WEIGH_BASE = 220;
const CHECKIN_BASE = 230;
const TODAY_SESSION = 240;
const WATER_BASE = 250;

/**
 * The user's own training week drives these. Capacitor counts weekdays
 * 1 = Sunday … 7 = Saturday, while the app stores 1 = Monday … 7 = Sunday.
 */
const toCapWeekday = d => (d % 7) + 1;

function trainingDays(state) {
  return Object.keys(state.program?.days || {})
    .map(Number)
    .filter(d => state.program.days[d]?.ex?.length)
    .sort();
}

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

/**
 * Rebuild the whole reminder set from current settings.
 * Returns { ok, count, reason } so the UI can tell the user what actually happened.
 */
export async function rescheduleAll(state) {
  if (!isNative()) return { ok: false, count: 0, reason: "web" };

  const granted = await ensurePermission();
  if (!granted) return { ok: false, count: 0, reason: "denied" };

  const { slots } = state.profile;
  const s = state.settings;

  // Clear only the IDs we own, so nothing else on the device is disturbed.
  const owned = [
    ...Array.from({ length: 20 }, (_, i) => MEAL_BASE + i),
    ...Array.from({ length: 7 }, (_, i) => TRAIN_BASE + i),
    ...Array.from({ length: 7 }, (_, i) => REST_BASE + i),
    WEIGH_BASE,
    CHECKIN_BASE,
    TODAY_SESSION,
    ...Array.from({ length: 3 }, (_, i) => WATER_BASE + i)
  ].map(id => ({ id }));

  try {
    const pending = await LocalNotifications.getPending();
    const toCancel = pending.notifications.filter(n => owned.some(o => o.id === n.id));
    if (toCancel.length) await LocalNotifications.cancel({ notifications: toCancel });
  } catch {
    /* nothing pending yet */
  }

  const notifications = [];

  if (s.notifyMeals) {
    slots.forEach((slot, i) => {
      notifications.push({
        id: MEAL_BASE + i,
        title: `${slot.name} — ${slot.time}`,
        body: `Meal ${i + 1} of ${slots.length}. Open Bulk Clock to log it.`,
        schedule: { on: hm(slot.time), allowWhileIdle: true },
        smallIcon: "ic_stat_icon",
        channelId: "meals"
      });
    });
  }

  const training = trainingDays(state);

  if (s.notifyTraining) {
    training.forEach((day, i) => {
      notifications.push({
        id: TRAIN_BASE + i,
        title: `${state.program.days[day].name} at ${state.program.days[day].time || s.trainingTime}`,
        body: "Log every set. Add weight only once you hit the top of the rep range on all sets.",
        schedule: { on: { weekday: toCapWeekday(day), ...hm(state.program.days[day].time || s.trainingTime) }, allowWhileIdle: true },
        smallIcon: "ic_stat_icon",
        channelId: "training"
      });
    });
  }

  if (s.notifyRestDay) {
    [1, 2, 3, 4, 5, 6, 7].filter(d => !training.includes(d)).forEach((day, i) => {
      notifications.push({
        id: REST_BASE + i,
        title: "Rest day",
        body: "No session today. Eat the full target anyway — recovery is where the muscle gets built.",
        schedule: { on: { weekday: toCapWeekday(day), hour: 9, minute: 0 }, allowWhileIdle: true },
        smallIcon: "ic_stat_icon",
        channelId: "training"
      });
    });
  }

  if (s.notifyWater) {
    // Three evenly spread nudges rather than an hourly drip — the point is to
    // catch someone who has forgotten, not to nag someone who hasn't.
    ["11:00", "15:00", "19:00"].forEach((t, i) => {
      notifications.push({
        id: WATER_BASE + i,
        title: "Water",
        body: `Aiming for ${(s.waterTargetMl / 1000).toFixed(1)} L today. Top up if you're behind.`,
        schedule: { on: hm(t), allowWhileIdle: true },
        smallIcon: "ic_stat_icon",
        channelId: "meals"
      });
    });
  }

  if (s.notifyCheckin) {
    notifications.push({
      id: CHECKIN_BASE,
      title: "How did today go?",
      body: "Tick off the meals you actually ate and whether you trained. Takes ten seconds.",
      schedule: { on: hm(s.checkinTime), allowWhileIdle: true },
      smallIcon: "ic_stat_icon",
      channelId: "checkin"
    });
  }

  if (s.notifyWeighIn && s.trackWeight) {
    notifications.push({
      id: WEIGH_BASE,
      title: "Weigh in",
      body: "Morning, after the bathroom, before eating. Same conditions every day.",
      schedule: { on: hm(s.weighInTime), allowWhileIdle: true },
      smallIcon: "ic_stat_icon",
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
 * Reschedule the single reminder for today's session after it has been moved.
 *
 * The weekly repeating reminder still exists for every other week, so this is a
 * one-shot at an exact timestamp that simply lands first. If the new time has
 * already passed, the override is respected by cancelling rather than firing late.
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
  if (!session?.ex?.length) return false;

  const time = state.sessionOverride?.[dateKey] || session.time || state.settings.trainingTime;
  const [hour, minute] = String(time).split(":").map(Number);
  const [y, m, d] = dateKey.split("-").map(Number);
  const at = new Date(y, m - 1, d, hour || 0, minute || 0, 0, 0);

  try {
    await LocalNotifications.cancel({ notifications: [{ id: TODAY_SESSION }] });
  } catch {
    /* nothing pending */
  }
  if (at.getTime() <= Date.now()) return false;

  try {
    await createChannels();
    await LocalNotifications.schedule({
      notifications: [{
        id: TODAY_SESSION,
        title: `${session.name} at ${time}`,
        body: "Moved for today. Log every set as you go.",
        schedule: { at, allowWhileIdle: true },
        smallIcon: "ic_stat_icon",
        channelId: "training"
      }]
    });
    return true;
  } catch {
    return false;
  }
}

async function createChannels() {
  if (Capacitor.getPlatform() !== "android") return;
  const channels = [
    { id: "meals", name: "Meal reminders", importance: 4, visibility: 1 },
    { id: "training", name: "Training reminders", importance: 4, visibility: 1 },
    { id: "weigh", name: "Weigh-in", importance: 3, visibility: 1 },
    { id: "checkin", name: "Daily check-in", importance: 4, visibility: 1 }
  ];
  for (const c of channels) {
    try {
      await LocalNotifications.createChannel(c);
    } catch {
      /* channel already exists */
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
  await LocalNotifications.schedule({
    notifications: [{
      id: 999,
      title: "Bulk Clock is set up",
      body: "Reminders will arrive like this, even with no internet.",
      schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true },
      smallIcon: "ic_stat_icon",
      channelId: "meals"
    }]
  });
  return true;
}
