import React, { useEffect, useRef, useState } from "react";
import { Home, Utensils, Dumbbell, TrendingUp, Bell, User } from "lucide-react";
import { Photo } from "./components/Photo.jsx";
import Onboarding from "./screens/Onboarding.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import Nutrition from "./screens/Nutrition.jsx";
import Training from "./screens/Training.jsx";
import Stats from "./screens/Stats.jsx";
import Profile from "./screens/Profile.jsx";
import { getState, useStore, pruneSessionOverrides, pruneReminders, todayKey } from "./lib/store.js";
import { rescheduleAll, scheduleTodaySession, isNative, onNotificationTap, suppressDoneToday } from "./lib/notify.js";
import ReminderTakeover from "./components/ReminderTakeover.jsx";
import { dueEvent } from "./lib/reminders.js";
import { autoBackup } from "./lib/backup.js";
import { t, setLocale, detectLocale, getLocale } from "./lib/i18n.js";

const TABS = [
  ["home", "nav.today", Home, Dashboard],
  ["diet", "nav.diet", Utensils, Nutrition],
  ["training", "nav.training", Dumbbell, Training],
  ["stats", "nav.progress", TrendingUp, Stats]
];

function greeting() {
  const h = new Date().getHours();
  return t(h < 12 ? "greeting.morning" : h < 18 ? "greeting.afternoon" : "greeting.evening");
}

/** Paint the chosen theme on <html> so the CSS variables switch wholesale. */
function useTheme(pref) {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved = pref === "system" ? (mq.matches ? "light" : "dark") : pref;
      root.setAttribute("data-theme", resolved);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", resolved === "light" ? "#f4f5f0" : "#0a0b0d");
    };
    apply();
    if (pref !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [pref]);
}

export default function App() {
  const onboarded = useStore(s => s.profile.onboarded);
  const name = useStore(s => s.profile.name);
  const avatar = useStore(s => s.profile.photo);
  const objective = useStore(s => s.profile.objective);
  const theme = useStore(s => s.settings.theme);
  const language = useStore(s => s.settings.language);
  const [tab, setTab] = useState("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [reminder, setReminder] = useState(null);
  const scrollRef = useRef(null);

  useTheme(theme);

  // Language, and with Arabic the whole document flips to right-to-left.
  // `null` means the user hasn't chosen, so the phone's own setting wins.
  const [, bumpLocale] = useState(0);
  useEffect(() => {
    setLocale(language || detectLocale());
    bumpLocale(n => n + 1);
  }, [language]);

  // Re-arm reminders on every launch so they survive reboots and force-stops.
  useEffect(() => {
    if (!onboarded) return;
    pruneSessionOverrides();
    pruneReminders();
    // Weekly at most, and it never blocks anything.
    autoBackup().catch(() => {});
    if (!isNative()) return;
    rescheduleAll(getState())
      .then(() => scheduleTodaySession(getState(), todayKey()))
      .then(() => suppressDoneToday(getState()));
  }, [onboarded]);

  /**
   * The full-screen reminder.
   *
   * Checked on a timer, on app resume and when a notification is tapped, so it
   * appears whether the phone woke you or you happened to open the app. The
   * check is cheap — it reads state already in memory — but it is throttled to
   * once every 20 seconds because there is nothing to gain from being faster.
   */
  useEffect(() => {
    if (!onboarded) return;

    const check = () => {
      const next = dueEvent();
      setReminder(prev => {
        if (!next) return null;
        if (prev && prev.id === next.id) return prev;   // don't re-mount mid-interaction
        return next;
      });
    };

    check();
    // Anything answered since the last pass should stop reminding.
    if (isNative()) suppressDoneToday(getState());
    const id = setInterval(check, 20000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    const offTap = onNotificationTap(check);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      offTap?.();
    };
  }, [onboarded]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [tab, profileOpen]);

  if (!onboarded) {
    return <div className="shell"><Onboarding /></div>;
  }

  const Screen = TABS.find(t => t[0] === tab)[3];
  const objLabel = t(`objective.${objective}`);

  return (
    <div className="shell">
      <header className="appbar">
        <div className="appbar-in">
          <button className="avatar" onClick={() => setProfileOpen(true)} aria-label="Profile and settings">
            <Photo id={avatar} alt="" fallback={<User size={20} />} />
          </button>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="caps neon">{objLabel}</div>
            <div className="h4" style={{ marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {greeting()}{name ? `, ${name}` : ""}
            </div>
          </div>
          <button
            className="btn-ghost" onClick={() => { setProfileOpen(false); setTab("stats"); }}
            aria-label="Progress" style={{ flex: "0 0 auto" }}
          >
            <Bell size={21} />
          </button>
        </div>
      </header>

      <div className="scroll" ref={scrollRef}>
        <div className="fade-in" key={profileOpen ? "profile" : tab}>
          {profileOpen ? <Profile onClose={() => setProfileOpen(false)} /> : <Screen onGo={setTab} />}
        </div>
      </div>

      <nav className="tabs">
        <div className="row" style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}>
          {TABS.map(([id, label, Ico]) => (
            <button
              key={id}
              aria-current={!profileOpen && tab === id}
              onClick={() => { setProfileOpen(false); setTab(id); }}
            >
              <Ico size={21} strokeWidth={2.2} />
              {t(label)}
            </button>
          ))}
        </div>
      </nav>

      {reminder && (
        <ReminderTakeover
          event={reminder}
          onClose={() => {
            setReminder(null);
            if (reminder.kind === "session") { setProfileOpen(false); setTab("training"); }
          }}
        />
      )}
    </div>
  );
}
