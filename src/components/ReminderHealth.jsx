import React, { useEffect, useState } from "react";
import {
  ShieldCheck, AlertTriangle, Check, Bell, BatteryCharging, Clock, ChevronRight,
  Smartphone, AlarmClock, Utensils, Dumbbell
} from "lucide-react";
import { useStore, setSetting } from "../lib/store.js";
import { isNative, ensurePermission, pendingCount } from "../lib/notify.js";
import {
  permissions as alarmPermissions, openExactAlarmSettings, openFullScreenSettings,
  openBatterySettings, testAlarm
} from "../lib/fullscreenAlarm.js";

/**
 * Why a reminder didn't arrive.
 *
 * Android has three separate ways to silently swallow a scheduled notification,
 * and an app that just says "reminders are on" while the OS drops them is worse
 * than useless. This lists all three, says which ones the app can see for itself
 * and which it can't, and stops pretending about the difference.
 */
export default function ReminderHealth() {
  const settings = useStore(s => s.settings);
  const [permission, setPermission] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [alarm, setAlarm] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!isNative()) { setPermission("web"); return; }
    (async () => {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      try {
        const p = await LocalNotifications.checkPermissions();
        if (alive) setPermission(p.display);
      } catch {
        if (alive) setPermission("unknown");
      }
      const n = await pendingCount();
      if (alive) setPending(n);
      const a = await alarmPermissions();
      if (alive) setAlarm(a);
    })();
    return () => { alive = false; };
  }, [settings]);

  if (!isNative()) {
    return (
      <div className="note warn">
        <b>Running in a browser.</b> Scheduled reminders only fire in the installed app — the
        full-screen takeover still works here while the app is open.
      </div>
    );
  }

  const granted = permission === "granted";
  const scheduled = (pending ?? 0) > 0;
  const batteryAcked = !!settings.batteryAcknowledged;

  const checks = [
    {
      id: "perm",
      icon: Bell,
      label: "Notifications allowed",
      ok: granted,
      detail: granted
        ? "Android will deliver what the app schedules."
        : "Nothing can arrive until this is granted.",
      action: granted ? null : {
        label: busy ? "Asking…" : "Allow notifications",
        run: async () => {
          setBusy(true);
          await ensurePermission();
          const { LocalNotifications } = await import("@capacitor/local-notifications");
          const p = await LocalNotifications.checkPermissions().catch(() => null);
          setPermission(p?.display || "denied");
          setBusy(false);
        }
      }
    },
    {
      id: "scheduled",
      icon: Clock,
      label: `${pending ?? 0} reminders scheduled`,
      ok: scheduled,
      detail: scheduled
        ? "Both the early warning and the on-time one, for every meal and session."
        : "Nothing is queued. Turn a reminder type on, or tap Reschedule below."
    },
    {
      id: "exact",
      icon: Clock,
      label: "Exact alarms allowed",
      ok: !!alarm?.exactAlarms,
      detail: alarm?.exactAlarms
        ? "Reminders land on the minute, and Doze cannot defer them."
        : "Without this Android delivers reminders in a ten-minute window instead of on the minute. Lunch at 13:07 is still useful, but it isn't what you set.",
      action: alarm?.exactAlarms ? null : {
        label: "Open the setting",
        run: openExactAlarmSettings
      }
    },
    {
      id: "fullscreen",
      icon: Smartphone,
      label: "Full-screen reminders allowed",
      ok: !!alarm?.fullScreen,
      detail: alarm?.fullScreen
        ? "A due reminder takes over the screen, even with the phone locked in your pocket."
        : "Android 14 made this a permission and only grants it automatically to alarm and calling apps. Without it, reminders still arrive — as a card at the top of the screen rather than taking it over.",
      action: alarm?.fullScreen ? null : {
        label: "Open the setting",
        run: openFullScreenSettings
      }
    },
    {
      id: "battery",
      icon: BatteryCharging,
      label: "Battery optimisation off",
      ok: alarm?.batteryUnrestricted ?? batteryAcked,
      detail: (alarm?.batteryUnrestricted ?? batteryAcked)
        ? "Android will not defer this app's alarms while the phone sits idle."
        : "Doze can delay a reminder by up to an hour once the phone has been still for a while. Set this app to Unrestricted.",
      action: (alarm?.batteryUnrestricted ?? batteryAcked) ? null : {
        label: "Open battery settings",
        run: async () => { await openBatterySettings(); setSetting({ batteryAcknowledged: true }); }
      }
    }
  ];

  const problems = checks.filter(c => !c.ok).length;

  return (
    <div>
      <div className={"note " + (problems === 0 ? "" : "warn")} style={{ marginBottom: 14 }}>
        {problems === 0 ? (
          <>
            <ShieldCheck size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
            <b>Reminders should arrive on time.</b> All three things Android needs are in place.
          </>
        ) : (
          <>
            <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
            <b>{problems} thing{problems === 1 ? "" : "s"} could stop a reminder arriving.</b> Android
            can drop a scheduled notification silently, so it is worth clearing all three.
          </>
        )}
      </div>

      {checks.map(c => {
        const Icon = c.icon;
        return (
          <div className="card-sm" key={c.id} style={{ marginBottom: 9 }}>
            <div className="row">
              <span
                className="ico"
                style={{
                  width: 36, height: 36, flex: "0 0 36px", borderRadius: 11, display: "grid", placeItems: "center",
                  background: c.ok ? "var(--accent-a20)" : "var(--warn-bg)",
                  color: c.ok ? "var(--accent-text)" : "var(--warn)"
                }}
              >
                {c.ok ? <Check size={18} strokeWidth={3} /> : <Icon size={17} />}
              </span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="h4" style={{ display: "block", fontSize: 15 }}>{c.label}</span>
              </span>
            </div>
            <p className="dim" style={{ fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.5 }}>{c.detail}</p>
            {c.action && (
              <button className="btn btn-sm btn-secondary" style={{ marginTop: 12 }} onClick={c.action.run} disabled={busy}>
                {c.action.label} <ChevronRight size={14} />
              </button>
            )}
          </div>
        );
      })}

      {alarm?.supported && (
        <>
          <div className="sect-h" style={{ marginTop: 22, marginBottom: 10 }}>
            <h2 className="h4"><AlarmClock size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Hear it for yourself</h2>
          </div>
          <p className="note" style={{ marginBottom: 12 }}>
            Fires a real alarm in ten seconds, with that kind's own sound.{" "}
            <b>Lock the phone straight after tapping</b> — that is the whole point, and it is the
            only way to see the takeover properly.
          </p>
          <div className="row wrap" style={{ gap: 10 }}>
            <button className="btn btn-sm btn-primary" onClick={() => testAlarm("meal", 10)}>
              <Utensils size={15} /> Test a meal alarm
            </button>
            <button className="btn btn-sm btn-quiet" onClick={() => testAlarm("training", 10)}>
              <Dumbbell size={15} /> Test a training alarm
            </button>
          </div>
        </>
      )}

      <p className="note" style={{ marginTop: 14 }}>
        A few manufacturers — Xiaomi, Oppo, Huawei, Samsung — add their own startup manager on top
        of all this. If reminders still arrive late on one of those, the app's <b>autostart</b>
        permission is the next place to look.
      </p>
    </div>
  );
}
