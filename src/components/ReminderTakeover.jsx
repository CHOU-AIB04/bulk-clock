import React, { useEffect, useState } from "react";
import { Check, X, Clock, Utensils, Dumbbell, AlarmClock, Plus, MoonStar } from "lucide-react";
import {
  useStore, todayKey, dayTotals, targetsFor, setMealCheck, setTrainedCheck,
  snoozeReminder, dismissReminder
} from "../lib/store.js";
import { relativeTime } from "../lib/reminders.js";
import AddSheet from "./AddSheet.jsx";
import { t } from "../lib/i18n.js";

const r0 = n => Math.round(n);
const pad = n => String(n).padStart(2, "0");

/**
 * The full-screen reminder.
 *
 * Modelled on the way a calendar alert takes over the screen rather than a
 * banner you swipe away without reading: one event, its time, and the two or
 * three things you might actually do about it. Everything else on the screen is
 * removed, because the whole point is that it cannot be half-ignored.
 *
 * It always offers a way out that isn't "dismiss": snooze keeps it honest, and
 * "skip" records a real answer that feeds the consistency tracking rather than
 * pretending the event never existed.
 */
export default function ReminderTakeover({ event, onClose, preview = false }) {
  const key = todayKey();
  const snoozeMinutes = useStore(s => s.settings.snoozeMinutes) || 15;
  const totals = dayTotals(key);
  const targets = targetsFor(key);
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isMeal = event.kind === "meal";
  const Icon = isMeal ? Utensils : Dumbbell;
  const kcalLeft = Math.max(0, targets.kcal - totals.kcal);

  /** In preview mode every button closes and nothing is written. */
  function close(action) {
    if (!preview) action?.();
    onClose();
  }

  if (adding && !preview) {
    return (
      <AddSheet
        dateKey={key}
        slot={event.slot}
        onClose={() => { dismissReminder(key, event.id); onClose(); }}
      />
    );
  }

  return (
    <div className="takeover" role="dialog" aria-modal="true" aria-label={`Reminder: ${event.title}`}>
      <div className="takeover-in">
        <div className="takeover-top">
          <span className="badge solid">
            <AlarmClock size={12} /> {preview ? t("reminder.preview") : event.late ? t("reminder.overdue") : t("reminder.comingUp")}
          </span>
          <span className="takeover-clock tnum">
            {pad(now.getHours())}:{pad(now.getMinutes())}
          </span>
        </div>

        <div className="takeover-body">
          <span className="takeover-ico"><Icon size={34} /></span>

          <div className="caps" style={{ color: "var(--outline)", marginTop: 26 }}>
            {isMeal ? t("reminder.meal") : t("reminder.trainingSession")} · {event.time}
          </div>

          <h1 className="h1 takeover-title">{event.title}</h1>

          <div className="takeover-when">
            <Clock size={16} />
            {relativeTime(event.deltaMin)}
          </div>

          {isMeal ? (
            <p className="takeover-sub">
              {kcalLeft > 0
                ? <><b>{r0(kcalLeft)} kcal</b> still to eat today, and <b>{Math.max(0, r0(targets.p - totals.p))} g</b> of protein.</>
                : <>You've already hit today's calorie target. Eat this one anyway if you're hungry — the target is a floor on a build, not a ceiling.</>}
            </p>
          ) : (
            <p className="takeover-sub">
              <b>{event.workout?.ex?.length || 0} movements</b> today. Log each set as you go and the
              app will tell you what to lift next time.
            </p>
          )}
        </div>

        <div className="takeover-actions">
          {isMeal ? (
            <>
              <button
                className="btn btn-primary btn-wide takeover-cta"
                onClick={() => (preview ? onClose() : setAdding(true))}
              >
                <Plus size={19} /> {t("reminder.logItNow")}
              </button>
              <button
                className="btn btn-secondary btn-wide"
                onClick={() => close(() => { setMealCheck(key, event.slot.id, "yes"); dismissReminder(key, event.id); })}
              >
                <Check size={18} /> {t("reminder.iveEaten")}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-primary btn-wide takeover-cta"
                onClick={() => close(() => dismissReminder(key, event.id))}
              >
                <Dumbbell size={19} /> {t("reminder.openSession")}
              </button>
              <button
                className="btn btn-secondary btn-wide"
                onClick={() => close(() => { setTrainedCheck(key, "yes"); dismissReminder(key, event.id); })}
              >
                <Check size={18} /> {t("reminder.alreadyTrained")}
              </button>
            </>
          )}

          <div className="row" style={{ gap: 10, marginTop: 4 }}>
            <button
              className="btn btn-quiet grow"
              onClick={() => close(() => snoozeReminder(key, event.id, snoozeMinutes))}
            >
              <MoonStar size={17} /> {t("reminder.snooze", { n: snoozeMinutes })}
            </button>
            <button
              className="btn btn-quiet grow"
              onClick={() => close(() => {
                if (isMeal) setMealCheck(key, event.slot.id, "no");
                else setTrainedCheck(key, "no");
                dismissReminder(key, event.id);
              })}
            >
              <X size={17} /> {t("reminder.skipping")}
            </button>
          </div>

          <p className="dim takeover-note">
            {preview
              ? "This is a preview — none of these buttons change anything. The real one appears on its own when a meal or session is due, and can also be answered straight from the notification."
              : "“Skipping it” records an honest answer rather than hiding the reminder — your consistency figure counts what actually happened, not what you meant to do."}
          </p>
        </div>
      </div>
    </div>
  );
}
