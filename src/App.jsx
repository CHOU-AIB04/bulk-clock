import React, { useEffect, useRef, useState } from "react";
import { Home, Utensils, Dumbbell, TrendingUp, Bell, User } from "lucide-react";
import { Photo } from "./components/Photo.jsx";
import Onboarding from "./screens/Onboarding.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import Nutrition from "./screens/Nutrition.jsx";
import Training from "./screens/Training.jsx";
import Stats from "./screens/Stats.jsx";
import Profile from "./screens/Profile.jsx";
import { getState, useStore, pruneSessionOverrides, todayKey } from "./lib/store.js";
import { rescheduleAll, scheduleTodaySession, isNative } from "./lib/notify.js";

const TABS = [
  ["home", "Today", Home, Dashboard],
  ["diet", "Diet", Utensils, Nutrition],
  ["training", "Training", Dumbbell, Training],
  ["stats", "Progress", TrendingUp, Stats]
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
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
  const [tab, setTab] = useState("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const scrollRef = useRef(null);

  useTheme(theme);

  // Re-arm reminders on every launch so they survive reboots and force-stops.
  useEffect(() => {
    if (!onboarded) return;
    pruneSessionOverrides();
    if (!isNative()) return;
    rescheduleAll(getState()).then(() => scheduleTodaySession(getState(), todayKey()));
  }, [onboarded]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [tab, profileOpen]);

  if (!onboarded) {
    return <div className="shell"><Onboarding /></div>;
  }

  const Screen = TABS.find(t => t[0] === tab)[3];
  const objLabel = objective === "lose" ? "Cutting" : objective === "maintain" ? "Maintaining" : "Building";

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
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
