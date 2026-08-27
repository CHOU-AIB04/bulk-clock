import React, { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, Check, Bell, BatteryCharging, Clock, ChevronRight } from "lucide-react";
import { useStore, setSetting } from "../lib/store.js";
import { isNative, ensurePermission, pendingCount } from "../lib/notify.js";

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
      id: "battery",
      icon: BatteryCharging,
      label: "Battery optimisation off",
      ok: batteryAcked,
      unknown: !batteryAcked,
      detail: batteryAcked
        ? "You've confirmed this. If reminders still drift, check it again after a system update."
        : "The app cannot read this setting, only ask. Android → Settings → Apps → Bulk Clock → Battery → Unrestricted. Without it, Doze can delay a reminder by up to an hour once the phone sits idle.",
      action: batteryAcked ? null : {
        label: "I've set it to unrestricted",
        run: () => setSetting({ batteryAcknowledged: true })
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

      <p className="note" style={{ marginTop: 12 }}>
        Android 13 and later also gate <b>exact alarms</b>. The app requests that permission in its
        manifest and most devices grant it on install, but a few manufacturers — Xiaomi, Oppo,
        Huawei — add their own startup manager on top. If reminders arrive late on one of those,
        the app's autostart setting is the next place to look.
      </p>
    </div>
  );
}
