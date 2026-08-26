import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Play, Square, Timer, Moon, Dumbbell, Pencil,
  Plus, Trash2, X, Search, LayoutTemplate, ArrowUp, ArrowDown, Check,
  Clock, RotateCcw, Calculator, Trophy, TrendingUp, Flame, StickyNote, Info
} from "lucide-react";
import { TEMPLATES, searchExercises, MUSCLES, emptyProgram } from "../data/program.js";
import {
  useStore, todayKey, addDays, parseKey, weekOfBlock, weekdayOf,
  lastSessionFor, workoutFor, setProgram, setProgramDay,
  sessionTimeFor, setSessionOverride, getState,
  setsFor, setLiftField, toggleSetDone, setSetType, addSet, removeSet,
  setSessionNote, startSession, endSession, sessionFor, sessionDoneSets
} from "../lib/store.js";
import { scheduleTodaySession, isNative } from "../lib/notify.js";
import { checkPRs, prLabel, suggestLoad, parseRepRange, tonnage, bestSet, epley } from "../lib/lifting.js";
import PlateCalculator from "../components/PlateCalculator.jsx";
import ExerciseHistory from "../components/ExerciseHistory.jsx";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const pad = n => String(n).padStart(2, "0");
const r1 = n => Math.round(n * 10) / 10;

/* ── rest timer ───────────────────────────────────────── */

/**
 * Starts itself the moment a set is ticked off, which is when a rest actually
 * begins. Before this it was a button you had to remember to press mid-set,
 * which is exactly when nobody remembers anything.
 */
function RestTimer({ autoKey, defaultLen = 150 }) {
  const [len, setLen] = useState(defaultLen);
  const [left, setLeft] = useState(null);
  const ref = useRef(null);
  const firstRun = useRef(true);

  useEffect(() => () => clearInterval(ref.current), []);

  const run = seconds => {
    clearInterval(ref.current);
    setLeft(seconds);
    ref.current = setInterval(() => {
      setLeft(v => {
        if (v === null) return null;
        if (v <= 1) {
          clearInterval(ref.current);
          if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  };

  // autoKey changes every time a set is completed.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (autoKey) run(len);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  function toggle() {
    if (left !== null) { clearInterval(ref.current); setLeft(null); return; }
    run(len);
  }

  const shown = left === null ? len : left;
  const running = left !== null;

  return (
    <div className="card-sm" style={{ marginTop: 14 }}>
      <div className="row">
        <Timer size={20} style={{ color: left === 0 ? "var(--accent-text)" : "var(--accent-text)" }} />
        <span className="stat grow" style={{ color: left === 0 ? "var(--accent-text)" : undefined }}>
          {left === 0 ? "GO" : `${Math.floor(shown / 60)}:${pad(shown % 60)}`}
        </span>
        <button className="btn btn-sm btn-quiet" disabled={running} onClick={() => setLen(l => (l === 150 ? 90 : l === 90 ? 180 : l === 180 ? 240 : 150))}>
          {len}s
        </button>
        <button className="btn btn-sm btn-primary" onClick={toggle}>
          {running ? <Square size={15} /> : <Play size={15} />} {running ? "Stop" : "Rest"}
        </button>
      </div>
      <p className="dim" style={{ fontSize: 11.5, margin: "10px 0 0" }}>
        Starts on its own when you tick a set. {len}s is the gap between sets — 2–3 min on compounds,
        60–90 s on isolation.
      </p>
    </div>
  );
}

/* ── one exercise, with every set ─────────────────────── */

function ExerciseCard({ dateKey, prescribed, onRested, onPlates, onHistory }) {
  const { name, sets: prescribedSets, reps } = prescribed;
  useStore(s => s.lifts[dateKey]);
  const sets = setsFor(dateKey, name);

  // The prescription defines how many rows exist until the user adds more.
  useEffect(() => {
    if (sets.length < prescribedSets) {
      for (let i = sets.length; i < prescribedSets; i++) addSet(dateKey, name, "work");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, name, prescribedSets]);

  const prev = lastSessionFor(name, dateKey);
  const suggestion = useMemo(() => suggestLoad(name, reps, dateKey), [name, reps, dateKey, prev?.key]);
  const pr = useMemo(() => checkPRs(name, dateKey), [name, dateKey, sets]);
  const badge = prLabel(pr);
  const range = parseRepRange(reps);

  const done = sets.filter(s => s.done && s.type !== "warmup").length;
  const target = sets.filter(s => s.type !== "warmup").length;
  const best = bestSet(sets);

  function fillSuggested() {
    if (!suggestion) return;
    sets.forEach((s, i) => {
      if (s.type === "warmup" || s.w != null) return;
      setLiftField(dateKey, name, i, "w", suggestion.weight);
    });
  }

  return (
    <div className="card-sm" style={{ marginBottom: 12 }}>
      <div className="row" style={{ alignItems: "baseline" }}>
        <button className="h4 grow" style={{ textAlign: "left" }} onClick={() => onHistory(name)}>
          {name}
        </button>
        <span className="caps neon">{target} × {reps}</span>
      </div>

      <div className="row" style={{ marginTop: 6, gap: 8 }}>
        <span className="dim tnum" style={{ fontSize: 12 }}>
          {prev
            ? "last · " + prev.sets.filter(s => s.w != null && s.type !== "warmup").map(s => `${s.w}×${s.r}`).join("  ")
            : "no history yet"}
        </span>
        <button className="icon-btn" style={{ marginLeft: "auto" }} aria-label={`Progress for ${name}`} onClick={() => onHistory(name)}>
          <TrendingUp size={16} />
        </button>
        <button className="icon-btn" aria-label="Plate calculator" onClick={() => onPlates(suggestion?.weight || best?.w || 60)}>
          <Calculator size={16} />
        </button>
      </div>

      {badge && (
        <div className="badge solid" style={{ marginTop: 10 }}>
          <Trophy size={12} /> {badge}
        </div>
      )}

      {suggestion && (
        <div className="note" style={{ marginTop: 12 }}>
          <b>{suggestion.kind === "up" ? `Go to ${suggestion.weight} kg` : `Stay at ${suggestion.weight} kg`}.</b>{" "}
          {suggestion.reason}
          {sets.some(s => s.type !== "warmup" && s.w == null) && (
            <div>
              <button className="btn btn-sm btn-secondary" style={{ marginTop: 10 }} onClick={fillSuggested}>
                Fill {suggestion.weight} kg in
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {sets.map((s, i) => (
          <div className={"set-row" + (s.done ? " done" : "") + (s.type === "warmup" ? " warmup" : "")} key={i}>
            <button
              className="tickbox" aria-pressed={s.done}
              aria-label={`Mark set ${i + 1} of ${name} ${s.done ? "not done" : "done"}`}
              onClick={() => { toggleSetDone(dateKey, name, i); if (!s.done) onRested(); }}
            >
              <Check size={16} strokeWidth={3} />
            </button>
            <span className="n">{i + 1}</span>
            <input
              type="number" inputMode="decimal" step="0.5" placeholder="kg"
              aria-label={`${name} set ${i + 1} weight`}
              value={s.w ?? ""}
              onChange={e => setLiftField(dateKey, name, i, "w", e.target.value)}
            />
            <span className="x">×</span>
            <input
              type="number" inputMode="numeric" step="1" placeholder="reps"
              aria-label={`${name} set ${i + 1} reps`}
              value={s.r ?? ""}
              onChange={e => setLiftField(dateKey, name, i, "r", e.target.value)}
            />
            <input
              className="rpe" inputMode="decimal" step="0.5" min="5" max="10" type="number" placeholder="RPE"
              aria-label={`${name} set ${i + 1} effort out of 10`}
              value={s.rpe ?? ""}
              onChange={e => setLiftField(dateKey, name, i, "rpe", e.target.value)}
            />
            <button
              className="icon-btn type-btn"
              title={s.type === "warmup" ? "Warm-up set — tap for drop set" : s.type === "drop" ? "Drop set — tap for work set" : "Work set — tap for warm-up"}
              aria-label={`Set ${i + 1} is a ${s.type === "warmup" ? "warm-up" : s.type === "drop" ? "drop" : "work"} set. Change it.`}
              onClick={() => setSetType(dateKey, name, i, s.type === "warmup" ? "drop" : s.type === "drop" ? "work" : "warmup")}
            >
              <span className={"set-tag " + (s.type === "warmup" ? "warmup" : s.type === "drop" ? "drop" : "")}>
                {s.type === "warmup" ? "W" : s.type === "drop" ? "D" : "•"}
              </span>
            </button>
            <button className="icon-btn" aria-label={`Remove set ${i + 1}`} onClick={() => removeSet(dateKey, name, i)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        <button className="btn btn-sm btn-quiet" onClick={() => addSet(dateKey, name, "work")}>
          <Plus size={14} /> Set
        </button>
        <button className="btn btn-sm btn-quiet" onClick={() => addSet(dateKey, name, "warmup")}>
          <Plus size={14} /> Warm-up
        </button>
        <span className="caps faint" style={{ marginLeft: "auto", fontSize: 9.5 }}>
          {done} / {target} done{best ? ` · e1RM ${r1(best.e1rm)} kg` : ""}
        </span>
      </div>

      {range && (
        <p className="dim" style={{ fontSize: 11.5, margin: "10px 0 0" }}>
          RPE is optional — how hard the set felt out of 10, where 10 means no rep left in the tank.
          Aim for 7–8 on most sets, 9 on the last one.
        </p>
      )}
    </div>
  );
}

/* ── exercise picker ──────────────────────────────────── */

function ExercisePicker({ onPick, onBack }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("All");
  const results = useMemo(() => searchExercises(q, muscle), [q, muscle]);

  return (
    <>
      <div className="sheet-h">
        <button className="btn-ghost" onClick={onBack} aria-label="Back"><ChevronLeft size={22} /></button>
        <h3 className="h3 grow" style={{ margin: 0 }}>Add exercise</h3>
      </div>

      <div className="search-wrap">
        <Search size={20} />
        <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search movements…" autoFocus />
      </div>
      <div className="chips scroll-x" style={{ margin: "12px 0 14px" }}>
        {["All", ...MUSCLES].map(m => (
          <button key={m} className="chip chip-outline" aria-pressed={muscle === m} onClick={() => setMuscle(m)}>{m}</button>
        ))}
      </div>

      {q.trim() && !results.some(r => r.name.toLowerCase() === q.trim().toLowerCase()) && (
        <button className="btn btn-secondary btn-wide" style={{ marginBottom: 14 }} onClick={() => onPick({ name: q.trim() })}>
          <Plus size={16} /> Use “{q.trim()}” as written
        </button>
      )}

      {results.map(e => (
        <button key={e.name} className="list-row" onClick={() => onPick(e)}>
          <span className="ico"><Dumbbell size={19} /></span>
          <span className="grow">
            <span className="t">{e.name}</span>
            <span className="d">{e.muscle} · {e.equipment}</span>
          </span>
          <Plus size={18} style={{ color: "var(--accent-text)" }} />
        </button>
      ))}
    </>
  );
}

/* ── one training day, editable ───────────────────────── */

function DayEditor({ weekday, day, defaultTime, onSave, onDelete, onBack }) {
  const [name, setName] = useState(day?.name || `${LONG[weekday - 1]} session`);
  const [time, setTime] = useState(day?.time || defaultTime || "17:00");
  const [ex, setEx] = useState(day?.ex ? structuredClone(day.ex) : []);
  const [picking, setPicking] = useState(false);

  const move = (i, d) => {
    const next = [...ex];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setEx(next);
  };
  const patch = (i, k, v) => setEx(ex.map((e, j) => (j === i ? { ...e, [k]: v } : e)));

  if (picking) {
    return <ExercisePicker onBack={() => setPicking(false)} onPick={e => { setEx([...ex, { name: e.name, sets: 3, reps: "8–12" }]); setPicking(false); }} />;
  }

  return (
    <>
      <div className="sheet-h">
        <button className="btn-ghost" onClick={onBack} aria-label="Back"><ChevronLeft size={22} /></button>
        <h3 className="h3 grow" style={{ margin: 0 }}>{LONG[weekday - 1]}</h3>
      </div>

      <div className="grid2">
        <label className="field">
          <span className="lab">Day name</span>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Push day" />
        </label>
        <label className="field">
          <span className="lab">Session time</span>
          <input className="input num" type="time" value={time} onChange={e => setTime(e.target.value)} />
        </label>
      </div>
      <p className="note" style={{ marginBottom: 18 }}>
        This day's reminder fires at <b>{time}</b>. Every training day has its own time, so a 09:00
        Monday and a 15:00 Thursday are one programme, not a compromise.
      </p>

      <div className="sect-h"><h2 className="h4">Exercises</h2><span className="caps faint">{ex.length}</span></div>

      {ex.length === 0 && <div className="empty" style={{ padding: "24px 16px" }}>Nothing here yet. Add your first movement below.</div>}

      {ex.map((e, i) => (
        <div className="card-sm" key={i} style={{ marginBottom: 10 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <input
              className="input" value={e.name} onChange={ev => patch(i, "name", ev.target.value)}
              style={{ padding: "9px 12px", fontSize: 14.5 }} aria-label="Exercise name"
            />
            <button className="icon-btn" onClick={() => setEx(ex.filter((_, j) => j !== i))} aria-label={`Remove ${e.name}`}>
              <Trash2 size={16} />
            </button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <label className="nested grow" style={{ padding: "8px 10px" }}>
              <span className="caps faint" style={{ fontSize: 9 }}>Sets</span>
              <input
                className="input num" type="number" min="1" max="12" value={e.sets}
                onChange={ev => patch(i, "sets", Math.max(1, Math.min(12, Number(ev.target.value) || 1)))}
                style={{ padding: "6px 8px", fontSize: 16, background: "var(--surface)", marginTop: 4 }}
              />
            </label>
            <label className="nested grow" style={{ padding: "8px 10px" }}>
              <span className="caps faint" style={{ fontSize: 9 }}>Reps</span>
              <input
                className="input" value={e.reps} onChange={ev => patch(i, "reps", ev.target.value)}
                style={{ padding: "6px 8px", fontSize: 16, background: "var(--surface)", marginTop: 4 }} placeholder="8–12"
              />
            </label>
            <button className="btn btn-icon btn-quiet" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={16} /></button>
            <button className="btn btn-icon btn-quiet" onClick={() => move(i, 1)} disabled={i === ex.length - 1} aria-label="Move down"><ArrowDown size={16} /></button>
          </div>
        </div>
      ))}

      <button className="btn btn-secondary btn-wide" style={{ marginTop: 8 }} onClick={() => setPicking(true)}>
        <Plus size={17} /> Add exercise
      </button>

      <div className="row" style={{ marginTop: 18, gap: 10 }}>
        <button className="btn btn-primary grow" disabled={!ex.length} onClick={() => onSave({ name: name.trim() || LONG[weekday - 1], time, ex })}>
          Save day
        </button>
        {day && (
          <button className="btn btn-danger" onClick={onDelete} aria-label="Make this a rest day">
            <Trash2 size={18} />
          </button>
        )}
      </div>
      <p className="note" style={{ marginTop: 14 }}>
        Deleting a day makes it a <b>rest day</b>. Nothing is scheduled for you that you didn't put here.
      </p>
    </>
  );
}

/* ── the whole week ───────────────────────────────────── */

function ProgramEditor({ onClose }) {
  const program = useStore(s => s.program);
  const defaultTime = useStore(s => s.settings.trainingTime);
  const [editingDay, setEditingDay] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [name, setName] = useState(program.name || "My programme");

  const wrap = inner => (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />
        {inner}
      </div>
    </div>
  );

  if (editingDay) {
    return wrap(
      <DayEditor
        weekday={editingDay}
        day={program.days?.[editingDay]}
        defaultTime={defaultTime}
        onBack={() => setEditingDay(null)}
        onSave={day => { setProgramDay(editingDay, day); setEditingDay(null); }}
        onDelete={() => { setProgramDay(editingDay, null); setEditingDay(null); }}
      />
    );
  }

  if (showTemplates) {
    return wrap(
      <>
        <div className="sheet-h">
          <button className="btn-ghost" onClick={() => setShowTemplates(false)} aria-label="Back"><ChevronLeft size={22} /></button>
          <h3 className="h3 grow" style={{ margin: 0 }}>Start from a template</h3>
        </div>
        <p className="note" style={{ marginBottom: 16 }}>
          A template only <b>fills the week in</b>. Every day, exercise, set count and rep range stays
          yours to change afterwards — this replaces whatever is in the week now.
        </p>
        {TEMPLATES.map(t => (
          <button
            key={t.id} className="pick" style={{ marginBottom: 10 }}
            onClick={() => { setProgram({ name: t.name, days: structuredClone(t.days) }); setName(t.name); setShowTemplates(false); }}
          >
            <span className="pick-ico"><LayoutTemplate size={21} /></span>
            <span className="grow">
              <span className="pick-t">{t.name}</span>
              <span className="pick-d">{t.desc}</span>
              <span className="pick-d neon">{Object.keys(t.days).length} training days a week</span>
            </span>
          </button>
        ))}
      </>
    );
  }

  const count = Object.keys(program.days || {}).length;

  return wrap(
    <>
      <div className="sheet-h">
        <h3 className="h3">My programme</h3>
        <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
      </div>

      <label className="field">
        <span className="lab">Programme name</span>
        <input
          className="input" value={name}
          onChange={e => { setName(e.target.value); setProgram({ ...program, name: e.target.value }); }}
          placeholder="My split"
        />
      </label>

      <div className="sect-h">
        <h2 className="h4">Your week</h2>
        <span className="caps faint">{count} training {count === 1 ? "day" : "days"}</span>
      </div>

      {[1, 2, 3, 4, 5, 6, 7].map(wd => {
        const day = program.days?.[wd];
        return (
          <button key={wd} className="list-row" onClick={() => setEditingDay(wd)}>
            <span className="ico" style={day ? { background: "var(--accent-a20)" } : undefined}>
              {day ? <Dumbbell size={19} /> : <Moon size={19} />}
            </span>
            <span className="grow">
              <span className="t">{LONG[wd - 1]}</span>
              <span className="d">{day ? `${day.name} · ${day.ex.length} movements` : "Rest day"}</span>
            </span>
            {day && (
              <span className="v">
                <span className="stat-sm tnum">{day.time || defaultTime}</span>
                <span className="d">reminder</span>
              </span>
            )}
            <Pencil size={17} style={{ color: "var(--outline)" }} />
          </button>
        );
      })}

      <button className="btn btn-secondary btn-wide" style={{ marginTop: 14 }} onClick={() => setShowTemplates(true)}>
        <LayoutTemplate size={17} /> Start from a template
      </button>
      <button
        className="btn btn-ghost btn-wide" style={{ marginTop: 6 }}
        onClick={() => { setProgram(emptyProgram(name)); }}
      >
        Clear the whole week
      </button>
    </>
  );
}

/* ── screen ───────────────────────────────────────────── */

function elapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export default function Training() {
  const [dateKey, setDateKey] = useState(todayKey());
  const [editing, setEditing] = useState(false);
  const [plates, setPlates] = useState(null);
  const [history, setHistory] = useState(null);
  const [restKey, setRestKey] = useState(0);
  const [, tick] = useState(0);

  const program = useStore(s => s.program);
  const session = useStore(s => s.lifts[dateKey]) || { ex: {}, startedAt: null, endedAt: null, note: "" };

  const week = weekOfBlock(dateKey);
  const wd = weekdayOf(dateKey);
  const wo = workoutFor(dateKey);
  const override = useStore(s => s.sessionOverride?.[dateKey]);
  const defaultTime = useStore(s => s.settings.trainingTime);
  const plannedTime = wo?.time || defaultTime;
  const sessionTime = sessionTimeFor(dateKey);
  const label = parseKey(dateKey).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

  // A running session ticks the clock; a finished one stays where it stopped.
  const live = session.startedAt && !session.endedAt;
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  function moveToday(time) {
    setSessionOverride(dateKey, time === plannedTime ? null : time);
    if (isNative() && dateKey === todayKey()) scheduleTodaySession(getState(), dateKey);
  }

  const totalSets = wo ? wo.ex.reduce((a, e) => a + (e.sets || 0), 0) : 0;
  const doneSets = sessionDoneSets(dateKey);
  const anyDays = Object.keys(program.days || {}).length > 0;

  const sessionTonnage = Object.values(session.ex || {}).reduce((n, rec) => n + tonnage(rec.sets), 0);
  const duration = session.startedAt ? (session.endedAt || Date.now()) - session.startedAt : 0;

  return (
    <div className="page" style={{ paddingTop: 18 }}>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn btn-icon btn-quiet" onClick={() => setDateKey(addDays(dateKey, -1))} aria-label="Previous day">
          <ChevronLeft size={20} />
        </button>
        <div className="grow" style={{ textAlign: "center" }}>
          <div className="h4">{label}</div>
          <div className="caps faint" style={{ marginTop: 3 }}>
            {program.name} {week >= 1 ? `· week ${week}` : ""}
          </div>
        </div>
        <button className="btn btn-icon btn-quiet" onClick={() => setDateKey(addDays(dateKey, 1))} aria-label="Next day">
          <ChevronRight size={20} />
        </button>
      </div>
      {dateKey !== todayKey() && (
        <button className="btn btn-ghost btn-wide" style={{ marginBottom: 10 }} onClick={() => setDateKey(todayKey())}>
          Back to today
        </button>
      )}

      <div className="glass lit">
        <div className="row" style={{ marginBottom: 10 }}>
          <span style={{ color: "var(--accent-text)" }}>{wo ? <Dumbbell size={22} /> : <Moon size={22} />}</span>
          <span className="caps neon">{wo ? DAYS[wd - 1] : "Rest day"}</span>
          {wo && <span className="badge" style={{ marginLeft: "auto" }}>{doneSets} / {totalSets} sets</span>}
        </div>
        <div className="h3">{wo ? wo.name : `${DAYS[wd - 1]} off`}</div>
        <p className="dim" style={{ fontSize: 14, marginTop: 8, marginBottom: 0 }}>
          {wo
            ? "Rest 2–3 min on compounds, 60–90 s on isolation. Last set of each exercise goes close to failure."
            : anyDays
              ? "No session today. Eat the full target anyway — recovery is where the muscle gets built."
              : "Your week is empty. Build your own split, or load a template and edit it."}
        </p>
        <button className="btn btn-secondary btn-wide" style={{ marginTop: 16 }} onClick={() => setEditing(true)}>
          <Pencil size={16} /> {anyDays ? "Edit my programme" : "Build my programme"}
        </button>
        {wo && totalSets > 0 && (
          <div className="bar" style={{ marginTop: 14 }}>
            <i style={{ width: `${Math.min(100, (doneSets / totalSets) * 100)}%` }} />
          </div>
        )}
      </div>

      {wo && (
        <>
          {/* ── the clock: when it's booked, and how long it's taking ── */}
          <div className="card-sm" style={{ marginTop: 14 }}>
            <div className="row">
              <Clock size={20} style={{ color: "var(--accent-text)" }} />
              <span className="grow">
                <span className="caps faint" style={{ display: "block", fontSize: 10 }}>
                  {override ? "Moved for today" : "Training at"}
                </span>
                <span className="h4" style={{ display: "block", marginTop: 3 }}>{sessionTime}</span>
              </span>
              <input
                className="input num" type="time" value={sessionTime}
                style={{ flex: "0 0 118px", padding: "10px 12px" }}
                aria-label="Training time today"
                onChange={e => moveToday(e.target.value)}
              />
              {override && (
                <button className="icon-btn" aria-label="Back to the scheduled time" onClick={() => moveToday(plannedTime)}>
                  <RotateCcw size={17} />
                </button>
              )}
            </div>
            <p className="note" style={{ marginTop: 12 }}>
              {override
                ? <>Just today. Your programme still says <b>{plannedTime}</b> for {DAYS[wd - 1]}.</>
                : <>Change this to move <b>only today's</b> reminder. The programme keeps its own time for every {DAYS[wd - 1]}.</>}
            </p>
          </div>

          <div className="card-sm" style={{ marginTop: 12 }}>
            <div className="row">
              <Flame size={19} style={{ color: "var(--accent-text)" }} />
              <span className="grow">
                <span className="caps faint" style={{ display: "block", fontSize: 10 }}>
                  {live ? "Session running" : session.endedAt ? "Session finished" : "Not started"}
                </span>
                <span className="stat-sm" style={{ display: "block", marginTop: 4 }}>
                  {session.startedAt ? elapsed(duration) : "—"}
                </span>
              </span>
              {!session.startedAt || session.endedAt ? (
                <button className="btn btn-sm btn-primary" onClick={() => startSession(dateKey)}>
                  <Play size={14} /> {session.endedAt ? "Resume" : "Start"}
                </button>
              ) : (
                <button className="btn btn-sm btn-quiet" onClick={() => endSession(dateKey)}>
                  <Square size={14} /> Finish
                </button>
              )}
            </div>
            {sessionTonnage > 0 && (
              <div className="dim tnum" style={{ fontSize: 12.5, marginTop: 10 }}>
                {Math.round(sessionTonnage).toLocaleString()} kg moved so far · {doneSets} hard sets
              </div>
            )}
          </div>

          <RestTimer autoKey={restKey} />
        </>
      )}

      {wo && (
        <div className="sect">
          <div className="sect-h">
            <h2 className="h3">Exercises</h2>
            <span className="caps faint">{wo.ex.length} movements</span>
          </div>

          {wo.ex.map(e => (
            <ExerciseCard
              key={e.name}
              dateKey={dateKey}
              prescribed={e}
              onRested={() => setRestKey(k => k + 1)}
              onPlates={w => setPlates(w)}
              onHistory={name => setHistory(name)}
            />
          ))}

          <div className="sect-h" style={{ marginTop: 24 }}>
            <h2 className="h4"><StickyNote size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Session notes</h2>
          </div>
          <textarea
            className="input" rows={3} value={session.note || ""}
            placeholder="How it felt, what hurt, what to change next time…"
            onChange={e => setSessionNote(dateKey, e.target.value)}
            aria-label="Session notes"
          />

          <p className="note" style={{ marginTop: 14 }}>
            <b>Double progression.</b> Stay at the same load until every work set hits the top of the
            rep range, then add 2.5 kg upper / 5 kg lower and work back up from the bottom. The
            suggestion on each exercise does this arithmetic for you.
          </p>
        </div>
      )}

      {!wo && anyDays && (
        <div className="sect">
          <div className="sect-h"><h2 className="h3">Your week</h2></div>
          {[1, 2, 3, 4, 5, 6, 7].map(d => {
            const day = program.days?.[d];
            return (
              <div className="list-row" key={d} style={{ opacity: day ? 1 : 0.55 }}>
                <span className="ico">{day ? <Dumbbell size={18} /> : <Moon size={18} />}</span>
                <span className="grow">
                  <span className="t">{LONG[d - 1]}</span>
                  <span className="d">{day ? `${day.name} · ${day.time || defaultTime}` : "Rest"}</span>
                </span>
                {day && <span className="caps faint">{day.ex.length}</span>}
              </div>
            );
          })}
        </div>
      )}

      {editing && <ProgramEditor onClose={() => setEditing(false)} />}
      {plates != null && <PlateCalculator initial={plates} onClose={() => setPlates(null)} />}
      {history && <ExerciseHistory exercise={history} onClose={() => setHistory(null)} />}
    </div>
  );
}
