import React, { useState } from "react";
import { Plus, Trash2, Award, Target, Flame, TrendingUp, Scale, CheckCircle2, Dumbbell } from "lucide-react";
import {
  useStore, todayKey, addDays, parseKey, dayTotals,
  weightSeries, rollingAvg, targetWeightAt, weekOfBlock,
  addChallenge, deleteChallenge, workoutFor, dayConsistency,
  consistencyStreak, consistencyRate, setSetting, targetsFor
} from "../lib/store.js";
import Ring from "../components/Ring.jsx";
import CheckIn from "../components/CheckIn.jsx";
import AdaptiveTargets from "../components/AdaptiveTargets.jsx";
import BodyPanel from "../components/BodyPanel.jsx";
import VolumePanel from "../components/VolumePanel.jsx";
import WeeklyReview from "../components/WeeklyReview.jsx";
import CalendarView from "../components/CalendarView.jsx";
import Achievements from "../components/Achievements.jsx";
import HistorySearch from "../components/HistorySearch.jsx";

const r0 = n => Math.round(n);

const CHALLENGE_TYPES = [
  { id: "consist", label: "Keep the whole day", hint: "A day counts when at least four fifths of your planned meals and sessions actually happened." },
  { id: "kcal", label: "Hit my calorie target", hint: "A day counts when you log at least 90% of your calorie target." },
  { id: "protein", label: "Hit my protein target", hint: "A day counts when you log at least 90% of your protein target." },
  { id: "log", label: "Log every meal", hint: "A day counts when every meal slot has something logged." },
  { id: "train", label: "Never miss a session", hint: "A training day counts when you log at least one set, or tick it off. Rest days always count." }
];

function Chart({ series, start, goal, programStart, weeks = 26 }) {
  const W = 320, H = 160, L = 30, R = 6, T = 10, B = 22;
  const iw = W - L - R, ih = H - T - B;
  const lo = Math.min(start, goal) - 1, hi = Math.max(start, goal) + 1;
  const x = w => L + iw * (w / weeks);
  const y = kg => T + ih * (1 - (kg - lo) / (hi - lo));

  const ticks = [];
  const step = (hi - lo) / 3;
  for (let i = 0; i <= 3; i++) ticks.push(Math.round(lo + step * i));

  const st = parseKey(programStart);
  const pts = series
    .map(o => ({ w: (parseKey(o.key) - st) / 604800000, v: o.v }))
    .filter(o => o.w >= -0.5 && o.w <= weeks + 0.5 && o.v >= lo && o.v <= hi);

  const roll = pts.map(p => {
    const win = pts.filter(q => q.w <= p.w && q.w > p.w - 1);
    return { w: p.w, v: win.reduce((s, q) => s + q.v, 0) / win.length };
  });

  return (
    <div className="card chart">
      <div className="caps faint" style={{ marginBottom: 14 }}>Weight vs trajectory</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Logged weight against the target trajectory">
        <defs>
          <linearGradient id="trendline" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-deep)" />
            <stop offset="100%" stopColor="var(--accent-bright)" />
          </linearGradient>
        </defs>
        {ticks.map(kg => (
          <g key={kg}>
            <line x1={L} y1={y(kg)} x2={W - R} y2={y(kg)} stroke="var(--outline-variant)" strokeWidth="1" />
            <text x={L - 7} y={y(kg) + 3.5} textAnchor="end" fontSize="9" fill="var(--outline)">{kg}</text>
          </g>
        ))}
        <line
          x1={x(0)} y1={y(start)} x2={x(weeks)} y2={y(goal)}
          stroke="var(--outline)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round"
        />
        {[0, Math.round(weeks / 2), weeks].map(w => (
          <text key={w} x={x(w)} y={H - 6} textAnchor={w === 0 ? "start" : w === weeks ? "end" : "middle"} fontSize="9" fill="var(--outline)">wk {w}</text>
        ))}
        {pts.map((p, i) => <circle key={i} cx={x(Math.max(0, p.w))} cy={y(p.v)} r="1.8" fill="var(--outline)" />)}
        {roll.length >= 3 && (
          <>
            <path
              d={roll.map((p, i) => `${i ? "L" : "M"}${x(Math.max(0, p.w)).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ")}
              fill="none" stroke="url(#trendline)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            />
            <circle cx={x(Math.max(0, roll[roll.length - 1].w))} cy={y(roll[roll.length - 1].v)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </>
        )}
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--outline)" }} />Target line</span>
        <span><i style={{ background: "var(--accent)" }} />7-day average</span>
        <span><i style={{ background: "var(--outline)", height: 6, width: 6, borderRadius: 99 }} />Weigh-ins</span>
      </div>
    </div>
  );
}

function challengeProgress(ch, state) {
  const days = [];
  for (let i = 0; i < ch.days; i++) {
    const key = addDays(ch.start, i);
    if (key > todayKey()) break;
    let hit = false;
    const totals = dayTotals(key);
    const dayTarget = targetsFor(key);
    if (ch.type === "consist") hit = dayConsistency(key).pct >= 0.8;
    else if (ch.type === "kcal") hit = totals.kcal >= dayTarget.kcal * 0.9;
    else if (ch.type === "protein") hit = totals.p >= dayTarget.p * 0.9;
    else if (ch.type === "log") {
      const entries = state.log[key]?.entries || [];
      hit = state.profile.slots.every(s => entries.some(e => e.slot === s.id));
    } else if (ch.type === "train") {
      const c = dayConsistency(key);
      hit = !c.trainingDue || c.trained;
    }
    days.push({ key, hit });
  }
  return days;
}

export default function Stats() {
  const state = useStore();
  const [showNew, setShowNew] = useState(false);
  const [nc, setNc] = useState({ name: "", type: "consist", days: 30 });

  const { profile, settings } = state;
  const series = weightSeries();
  const cur = rollingAvg(7, 0), prev = rollingAvg(7, 7);
  const delta = cur != null && prev != null ? cur - prev : null;
  const week = Math.max(0, Math.min(26, weekOfBlock() - 1));
  const target = targetWeightAt(week);
  const latest = series.length ? series[series.length - 1].v : null;

  const streak = consistencyStreak();
  const rate = consistencyRate(14);

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const key = addDays(todayKey(), i - 29);
    const c = dayConsistency(key);
    return { key, pct: c.pct, today: key === todayKey() };
  });
  const kept30 = last30.filter(d => d.pct >= 0.8).length;

  const sessionsThisWeek = Array.from({ length: 7 }, (_, i) => addDays(todayKey(), -i))
    .filter(k => dayConsistency(k).trainingDue && dayConsistency(k).trained).length;

  return (
    <div className="page" style={{ paddingTop: 18 }}>
      {/* ── consistency, the headline ── */}
      <div className="hero">
        <div className="row" style={{ position: "relative", zIndex: 1 }}>
          <div className="grow">
            <div className="caps">Consistency</div>
            <div className="stat-xl" style={{ marginTop: 12 }}>{Math.round(rate.pct * 100)}<span style={{ fontSize: 24 }}>%</span></div>
            <div style={{ fontSize: 14, marginTop: 8, color: "rgba(16,22,10,.66)", fontWeight: 600 }}>
              {rate.hit} of your last {rate.seen || 0} tracked days kept
            </div>
          </div>
          <Ring value={rate.pct * 100} max={100} id="consist" size={92} stroke={11} track="rgba(16,22,10,.18)">
            <Flame size={26} style={{ color: "var(--on-accent)" }} />
          </Ring>
        </div>
      </div>

      <div className="grid3" style={{ marginTop: 14 }}>
        {[
          ["Streak", streak, "days", Flame],
          ["Kept, 30d", kept30, "days", CheckCircle2],
          ["Sessions, 7d", sessionsThisWeek, "done", Dumbbell]
        ].map(([k, v, u, Ico]) => (
          <div className="card-sm" key={k} style={{ padding: 14 }}>
            <Ico size={17} style={{ color: "var(--accent-text)" }} />
            <div className="caps faint" style={{ fontSize: 10, marginTop: 10 }}>{k}</div>
            <div className="stat-sm" style={{ marginTop: 6 }}>{v}<span className="dim" style={{ fontSize: 11, fontWeight: 400 }}> {u}</span></div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="caps faint" style={{ marginBottom: 14 }}>Last 30 days</div>
        <div className="streak-grid">
          {last30.map(d => (
            <i
              key={d.key}
              className={(d.pct >= 0.8 ? "hit" : d.pct >= 0.4 ? "half" : "") + (d.today ? " today" : "")}
              title={`${d.key} — ${Math.round(d.pct * 100)}%`}
            />
          ))}
        </div>
        <div className="dim" style={{ fontSize: 13, marginTop: 14 }}>
          <b style={{ color: "var(--on-surface)" }}>{kept30} of 30</b> days kept. A faded square is a
          partial day — some meals happened, some didn't.
        </div>
      </div>

      {/* ── the week in review ── */}
      <div className="sect">
        <div className="sect-h"><h2 className="h3">Week in review</h2></div>
        <WeeklyReview />
      </div>

      {/* ── training volume ── */}
      <div className="sect">
        <div className="sect-h"><h2 className="h3">Weekly volume</h2></div>
        <VolumePanel />
      </div>

      {/* ── the measured target ── */}
      <div className="sect">
        <div className="sect-h"><h2 className="h3">Targets</h2></div>
        <AdaptiveTargets />
      </div>

      {/* ── today's follow-up, again, for the days you open this tab first ── */}
      <div className="sect">
        <CheckIn dateKey={todayKey()} />
      </div>

      {/* ── weight, entirely optional ── */}
      <div className="sect">
        <div className="sect-h">
          <h2 className="h3">Weight</h2>
          <button
            className="btn btn-sm btn-quiet"
            onClick={() => setSetting({ trackWeight: !settings.trackWeight })}
          >
            {settings.trackWeight ? "Stop tracking" : "Track weight"}
          </button>
        </div>

        {!settings.trackWeight ? (
          <div className="empty">
            <span className="empty-ico"><Scale size={24} /></span>
            Weight tracking is off. Progress here is measured by what you actually did.
          </div>
        ) : series.length === 0 ? (
          <div className="empty">
            <span className="empty-ico"><Scale size={24} /></span>
            No weigh-ins yet. There's an optional weight field in the daily check-in above —
            use it whenever you feel like it, skip it whenever you don't.
          </div>
        ) : (
          <>
            <div className="grid-auto">
              {[
                ["7-day avg", cur != null ? cur.toFixed(1) : "—", "kg"],
                ["vs last week", delta != null ? (delta >= 0 ? "+" : "") + delta.toFixed(2) : "—", "kg"],
                ["Target now", target.toFixed(1), "kg"],
                ["To go", latest != null ? Math.abs(profile.goalWeight - latest).toFixed(1) : Math.abs(profile.goalWeight - profile.startWeight).toFixed(1), "kg"]
              ].map(([k, v, u]) => (
                <div className="card-sm" key={k}>
                  <div className="caps faint" style={{ fontSize: 10 }}>{k}</div>
                  <div className="stat-sm" style={{ marginTop: 8 }}>{v}<span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> {u}</span></div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <Chart series={series} start={profile.startWeight} goal={profile.goalWeight} programStart={profile.programStart} />
            </div>
          </>
        )}
      </div>

      {/* ── the month ── */}
      <div className="sect">
        <div className="sect-h"><h2 className="h3">Calendar</h2></div>
        <CalendarView />
      </div>

      {/* ── milestones ── */}
      <div className="sect">
        <div className="sect-h"><h2 className="h3">Achievements</h2></div>
        <Achievements />
      </div>

      {/* ── the body ── */}
      <div className="sect">
        <div className="sect-h"><h2 className="h3">Body</h2></div>
        <BodyPanel />
      </div>

      {/* ── look anything up ── */}
      <div className="sect">
        <div className="sect-h"><h2 className="h3">Search your history</h2></div>
        <HistorySearch />
      </div>

      {/* ── challenges ── */}
      <div className="sect">
        <div className="sect-h">
          <h2 className="h3">Challenges</h2>
          <span className="caps faint">{state.challenges.length} active</span>
        </div>

        {state.challenges.map(ch => {
          const days = challengeProgress(ch, state);
          const hits = days.filter(d => d.hit).length;
          const pct = Math.round((hits / ch.days) * 100);
          const type = CHALLENGE_TYPES.find(t => t.id === ch.type);
          return (
            <div className="card" key={ch.id} style={{ marginBottom: 12 }}>
              <div className="row">
                <span style={{ width: 44, height: 44, borderRadius: "var(--r)", display: "grid", placeItems: "center", background: "var(--accent-a15)", color: "var(--accent-text)", flex: "0 0 44px" }}>
                  <Award size={20} />
                </span>
                <span className="grow">
                  <span className="h4" style={{ display: "block" }}>{ch.name}</span>
                  <span className="dim" style={{ fontSize: 12 }}>{type?.label} &middot; {ch.days} days from {ch.start}</span>
                </span>
                <button className="icon-btn" onClick={() => deleteChallenge(ch.id)} aria-label="Delete challenge">
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="bar" style={{ marginTop: 14 }}><i style={{ width: pct + "%" }} /></div>
              <div className="row" style={{ marginTop: 10 }}>
                <span className="tnum dim" style={{ fontSize: 13 }}>{hits} / {ch.days} days won</span>
                <span className="caps neon" style={{ marginLeft: "auto" }}>{days.length} elapsed</span>
              </div>
            </div>
          );
        })}

        {!showNew ? (
          <button className="btn btn-secondary btn-wide" onClick={() => setShowNew(true)}>
            <Plus size={18} /> Start a challenge
          </button>
        ) : (
          <div className="card">
            <label className="field">
              <span className="lab">Name it</span>
              <input className="input" value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} placeholder="30 days kept" />
            </label>
            <label className="field">
              <span className="lab">What counts as a win</span>
              <select className="input" value={nc.type} onChange={e => setNc({ ...nc, type: e.target.value })}>
                {CHALLENGE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <p className="note" style={{ marginBottom: 16 }}>{CHALLENGE_TYPES.find(t => t.id === nc.type)?.hint}</p>
            <label className="field">
              <span className="lab">How long</span>
              <select className="input" value={nc.days} onChange={e => setNc({ ...nc, days: Number(e.target.value) })}>
                {[7, 14, 21, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </label>
            <div className="row" style={{ gap: 10 }}>
              <button
                className="btn btn-primary grow" disabled={!nc.name.trim()}
                onClick={() => {
                  addChallenge({ name: nc.name.trim(), type: nc.type, days: nc.days, start: todayKey() });
                  setNc({ name: "", type: "consist", days: 30 });
                  setShowNew(false);
                }}
              >
                <Target size={17} /> Start today
              </button>
              <button className="btn btn-quiet" onClick={() => setShowNew(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
