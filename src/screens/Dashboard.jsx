import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles, Plus, Play, Clock, Flame, Moon, Check, ChevronRight, Trash2,
  Dumbbell, Target, CheckCircle2, Utensils, TrendingUp, CopyPlus, Clock3, CalendarClock
} from "lucide-react";
import Ring from "../components/Ring.jsx";
import AddSheet from "../components/AddSheet.jsx";
import CheckIn from "../components/CheckIn.jsx";
import EntryEditor from "../components/EntryEditor.jsx";
import CopyDaySheet from "../components/CopyDaySheet.jsx";
import WaterCard from "../components/WaterCard.jsx";
import MealScheduleSheet from "../components/MealScheduleSheet.jsx";
import SwipeRow from "../components/SwipeRow.jsx";
import Planner from "../components/Planner.jsx";
import FoodAvatar, { MealAvatar } from "../components/FoodAvatar.jsx";
import {
  useStore, dayTotals, dayEntries, todayKey, addDays, parseKey,
  dayConsistency, consistencyStreak, consistencyRate, workoutFor,
  removeEntry, foodMap, sessionTimeFor, orphanEntries, targetsFor, weekBudget,
  planForSlot, planItemMacros, planItemName, logPlanned
} from "../lib/store.js";
import { headlineInsight } from "../lib/insights.js";
import { t } from "../lib/i18n.js";

const r0 = n => Math.round(n);
const pad = n => String(n).padStart(2, "0");
const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TONE_BADGE = { good: "", warn: "warn", danger: "danger", neutral: "" };

/** Last seven days, newest last — tap one to review or backfill it. */
function DateStrip({ value, onChange }) {
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const ref = useRef(null);

  // Today sits at the far right, so open the strip already scrolled to it.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div className="datestrip" role="group" aria-label="Pick a day" ref={ref}>
      {days.map(key => {
        const d = parseKey(key);
        const c = dayConsistency(key);
        return (
          <button
            key={key} aria-pressed={key === value} className={c.pct >= 0.8 ? "hit" : ""}
            onClick={() => onChange(key)}
          >
            <span className="dw">{key === today ? "Today" : DAYS[d.getDay()]}</span>
            <span className="dd">{d.getDate()}</span>
            <span className="dot" />
          </button>
        );
      })}
    </div>
  );
}

export default function Dashboard({ onGo }) {
  const profile = useStore(s => s.profile);
  const state = useStore();
  const [key, setKey] = useState(todayKey());
  const [adding, setAdding] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [copying, setCopying] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const isToday = key === todayKey();
  const targets = targetsFor(key);
  const weekly = useStore(s => s.settings.weeklyBudget) ? weekBudget(key) : null;
  const totals = dayTotals(key);
  const entries = dayEntries(key);
  const insight = headlineInsight(state);
  const streak = consistencyStreak();
  const wo = workoutFor(key);
  const fmap = foodMap();
  const orphans = orphanEntries(key);

  const bySlot = {};
  for (const e of entries) (bySlot[e.slot] ||= []).push(e);

  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const unlogged = profile.slots.filter(s => !(bySlot[s.id]?.length));
  const next = isToday
    ? (unlogged.find(s => toMin(s.time) >= mins - 90) || unlogged[unlogged.length - 1] || null)
    : unlogged[0] || null;

  let cd = "—", due = false;
  if (next && isToday) {
    const delta = toMin(next.time) - mins;
    due = delta < 0;
    const abs = Math.abs(delta);
    cd = `${due ? "+" : ""}${Math.floor(abs / 60)}:${pad(Math.floor(abs % 60))}`;
  }

  const kcalLeft = Math.max(0, targets.kcal - totals.kcal);
  const pct = targets.kcal ? Math.min(100, (totals.kcal / targets.kcal) * 100) : 0;

  const MACROS = [
    ["Protein", totals.p, targets.p, "var(--accent)"],
    ["Carbs", totals.c, targets.c, "var(--info)"],
    ["Fat", totals.f, targets.f, "var(--warn)"]
  ];

  // Everything the day still owes you, so the numbers are actionable not historical.
  const rate = consistencyRate(14);
  const consistency = dayConsistency(key);
  const mealsLeft = profile.slots.length - profile.slots.filter(sl => bySlot[sl.id]?.length).length;
  const perMeal = mealsLeft > 0 ? Math.round(kcalLeft / mealsLeft) : 0;
  const proteinLeft = Math.max(0, Math.round(targets.p - totals.p));
  const sessionsThisWeek = Array.from({ length: 7 }, (_, i) => addDays(key, -i))
    .filter(k => { const c = dayConsistency(k); return c.trainingDue && c.trained; }).length;
  const sessionsPlanned = Array.from({ length: 7 }, (_, i) => addDays(key, -i))
    .filter(k => dayConsistency(k).trainingDue).length;

  return (
    <div className="page" style={{ paddingTop: 14 }}>
      <DateStrip value={key} onChange={setKey} />

      {/* ── the headline slab ── */}
      <div className="hero" style={{ marginTop: 14 }}>
        <div className="row" style={{ position: "relative", zIndex: 1 }}>
          <div className="grow">
            <div className="caps">
              {isToday ? t("today.energy") : parseKey(key).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
              {targets.dayType ? ` · ${targets.dayType} day` : ""}
            </div>
            <div className="stat-xl" style={{ marginTop: 12 }}>{r0(totals.kcal)}</div>
            <div style={{ fontSize: 14, marginTop: 8, color: "rgba(16,22,10,.66)", fontWeight: 600 }}>
              of {targets.kcal} kcal · {kcalLeft > 0 ? `${r0(kcalLeft)} left` : "target reached"}
              {targets.delta ? ` · ${targets.delta > 0 ? "+" : ""}${targets.delta} for ${targets.dayType}` : ""}
            </div>
          </div>
          <Ring value={totals.kcal} max={targets.kcal} id="energy" size={96} stroke={11} track="rgba(16,22,10,.18)">
            <span className="stat-sm" style={{ color: "var(--on-accent)" }}>{r0(pct)}<span style={{ fontSize: 11 }}>%</span></span>
          </Ring>
        </div>
        <div
          className="bar on-accent" style={{ marginTop: 18, position: "relative", zIndex: 1 }}
          role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
          aria-label={`${r0(totals.kcal)} of ${targets.kcal} calories`}
        >
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ── macros ── */}
      <div className="grid3" style={{ marginTop: 14 }}>
        {MACROS.map(([label, v, t, color]) => {
          const left = Math.max(0, Math.round(t - v));
          return (
            <div className="card-sm" key={label} style={{ padding: 14 }}>
              <div className="caps faint" style={{ fontSize: 10 }}>{label}</div>
              <div className="stat-sm" style={{ marginTop: 8 }}>
                {r0(v)}<span className="dim" style={{ fontSize: 12, fontWeight: 400 }}>/{t}g</span>
              </div>
              <div className="bar" style={{ marginTop: 10, height: 5 }}>
                <i style={{ width: `${t ? Math.min(100, (v / t) * 100) : 0}%`, background: color }} />
              </div>
              <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>
                {left > 0 ? `${left} g left` : "done"}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── what the day still owes ── */}
      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card-sm">
          <div className="row" style={{ marginBottom: 10 }}>
            <Utensils size={17} style={{ color: "var(--accent-text)" }} />
            <span className="caps faint" style={{ fontSize: 10, marginLeft: "auto" }}>
              {consistency.hit} / {consistency.total} kept
            </span>
          </div>
          <div className="caps faint" style={{ fontSize: 10 }}>{t("today.mealsLeft")}</div>
          <div className="stat-sm" style={{ marginTop: 6 }}>
            {mealsLeft}<span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> of {profile.slots.length}</span>
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
            {mealsLeft > 0 ? `≈ ${perMeal} kcal each to finish` : "Every slot logged"}
          </div>
        </div>

        <div className="card-sm">
          <div className="row" style={{ marginBottom: 10 }}>
            <TrendingUp size={17} style={{ color: "var(--accent-text)" }} />
            <span className="caps faint" style={{ fontSize: 10, marginLeft: "auto" }}>14 days</span>
          </div>
          <div className="caps faint" style={{ fontSize: 10 }}>{t("today.consistency")}</div>
          <div className="stat-sm" style={{ marginTop: 6 }}>
            {Math.round(rate.pct * 100)}<span className="dim" style={{ fontSize: 12, fontWeight: 400 }}>%</span>
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
            {streak > 0 ? `${streak}-day streak` : "Streak broken — restart today"}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <WaterCard dateKey={key} />
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card-sm">
          <div className="row" style={{ marginBottom: 10 }}>
            <Target size={17} style={{ color: "var(--accent-text)" }} />
          </div>
          <div className="caps faint" style={{ fontSize: 10 }}>{t("today.proteinLeft")}</div>
          <div className="stat-sm" style={{ marginTop: 6 }}>
            {proteinLeft}<span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> g</span>
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
            {proteinLeft > 0
              ? `≈ ${Math.max(1, Math.round(proteinLeft / 25))} palm-sized portions`
              : "Target hit"}
          </div>
        </div>

        <div className="card-sm">
          <div className="row" style={{ marginBottom: 10 }}>
            <CheckCircle2 size={17} style={{ color: "var(--accent-text)" }} />
          </div>
          <div className="caps faint" style={{ fontSize: 10 }}>{t("today.sessionsWeek")}</div>
          <div className="stat-sm" style={{ marginTop: 6 }}>
            {sessionsThisWeek}<span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> / {sessionsPlanned}</span>
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
            {wo ? `Today at ${sessionTimeFor(key)}` : "Rest day"}
          </div>
        </div>
      </div>

      {weekly && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="row">
            <span className="grow">
              <span className="caps faint" style={{ display: "block", fontSize: 10 }}>{t("today.weeklyBudget")}</span>
              <span className="stat-sm" style={{ display: "block", marginTop: 6 }}>
                {(weekly.remaining / 1000).toFixed(1)}
                <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> k kcal left of {(weekly.target / 1000).toFixed(1)} k</span>
              </span>
            </span>
            <span className="stat-sm tnum" style={{ color: weekly.remaining < 0 ? "var(--warn)" : "var(--accent-text)" }}>
              {weekly.perDay > 0 ? `${weekly.perDay}` : "0"}
              <span className="dim" style={{ fontSize: 11, fontWeight: 400 }}>/day</span>
            </span>
          </div>
          <div className="bar" style={{ marginTop: 12 }}>
            <i className={weekly.pace > 1.05 ? "warn" : ""} style={{ width: `${Math.min(100, weekly.pace * 100)}%` }} />
          </div>
          <p className="dim" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
            {weekly.remaining >= 0
              ? `${weekly.daysLeft} day${weekly.daysLeft === 1 ? "" : "s"} left — about ${weekly.perDay} kcal each to finish the week on target. A short day here can be repaid on another.`
              : `You're ${Math.abs(weekly.remaining)} kcal over the week's budget with ${weekly.daysLeft} day${weekly.daysLeft === 1 ? "" : "s"} to go. Not a failure — just eat lighter than target for the rest of it.`}
          </p>
        </div>
      )}

      {/* ── next meal + actions ── */}
      {isToday && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="row">
            <span style={{ color: due ? "var(--warn)" : "var(--accent-text)" }}><Clock size={20} /></span>
            <span className="grow">
              <span className="caps faint" style={{ display: "block", fontSize: 10 }}>
                {next ? (due ? "Overdue" : "Next up") : "All meals logged"}
              </span>
              <span className="h4" style={{ display: "block", marginTop: 4 }}>{next ? next.name : "Nothing left today"}</span>
            </span>
            <span className="stat-sm tnum" style={{ color: due ? "var(--warn)" : undefined }}>{next ? cd : "✓"}</span>
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 14, gap: 10 }}>
        <button className="btn btn-primary grow" onClick={() => setAdding(next || profile.slots[0])}>
          <Plus size={18} /> {t("today.logFood")}
        </button>
        <button className="btn btn-quiet grow" onClick={() => onGo("training")}>
          <Dumbbell size={18} /> {t("today.train")}
        </button>
      </div>

      {/* ── insight ── */}
      {insight && isToday && (
        <div className="glass lit" style={{ marginTop: 20 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <Sparkles size={19} style={{ color: "var(--accent-text)" }} />
            <span className="h4 neon">{t("today.read")}</span>
            <span className={"badge " + TONE_BADGE[insight.tone]} style={{ marginLeft: "auto" }}>{insight.tag}</span>
          </div>
          <div className="body-lg" style={{ fontWeight: 600 }}>{insight.title}</div>
          <p className="dim" style={{ fontSize: 14, marginTop: 6, marginBottom: 0 }}>{insight.body}</p>
        </div>
      )}

      {/* ── the day's meals ── */}
      <div className="sect">
        <div className="sect-h">
          <h2 className="h3">{t("today.meals")}</h2>
          <span className="row" style={{ gap: 10 }}>
            <span className="caps faint">
              {t("today.loggedCount", {
                done: profile.slots.filter(s => bySlot[s.id]?.length).length,
                total: profile.slots.length
              })}
            </span>
            <button className="btn btn-sm btn-quiet" onClick={() => setCopying(true)} aria-label="Copy a day">
              <CopyPlus size={15} />
            </button>
            <button className="btn btn-sm btn-quiet" onClick={() => setScheduling(true)} aria-label="Edit meal schedule">
              <Clock3 size={15} />
            </button>
            <button className="btn btn-sm btn-quiet" onClick={() => setPlanning(true)} aria-label="Plan ahead">
              <CalendarClock size={15} />
            </button>
          </span>
        </div>

        <div className="tl">
          {profile.slots.map(slot => {
            const items = bySlot[slot.id] || [];
            const done = items.length > 0;
            const isNext = next?.id === slot.id && isToday;
            const sum = items.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p }), { kcal: 0, p: 0 });
            const firstFood = items.map(i => (i.ref ? fmap[i.ref] : null)).find(Boolean);
            return (
              <div className={`tl-item ${done ? "done" : ""} ${isNext ? "now" : ""}`} key={slot.id}>
                <button className="list-row" style={{ marginBottom: 0 }} onClick={() => setAdding(slot)}>
                  {firstFood
                    ? <FoodAvatar food={firstFood} />
                    : <span className="ico" style={done ? { background: "var(--accent-a20)" } : undefined}>
                        {done ? <Check size={20} /> : <Plus size={20} />}
                      </span>}
                  <span className="grow">
                    <span className="t">{slot.name}</span>
                    <span className="d" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {done ? items.map(i => i.name).join(", ") : t("today.scheduled", { time: slot.time })}
                    </span>
                  </span>
                  <span className="v">
                    {done
                      ? <><span className="stat-sm">{r0(sum.kcal)}</span><span className="d neon">{r0(sum.p)} g P</span></>
                      : <span className="tnum dim" style={{ fontSize: 14 }}>{slot.time}</span>}
                  </span>
                </button>

                {(() => {
                  const plannedItems = planForSlot(key, slot.id);
                  if (!plannedItems.length) return null;
                  const pt = plannedItems.reduce(
                    (a, it) => { const m = planItemMacros(it); return { kcal: a.kcal + m.kcal }; },
                    { kcal: 0 }
                  );
                  return (
                    <div className="planned-row">
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="caps faint" style={{ fontSize: 9.5 }}>{t("plan.planned")}</span>
                        <span
                          className="dim"
                          style={{ display: "block", fontSize: 12.5, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {plannedItems.map(planItemName).join(", ")} · {r0(pt.kcal)} kcal
                        </span>
                      </span>
                      <button className="btn btn-sm btn-primary" onClick={() => logPlanned(key, slot.id)}>
                        <Check size={14} /> {t("plan.ateIt")}
                      </button>
                    </div>
                  );
                })()}

                {items.length > 0 && (
                  <div style={{ paddingLeft: 4, marginTop: 2, marginBottom: 6 }}>
                    {items.map(e => (
                      <SwipeRow key={e.id} label={e.name} onDelete={() => removeEntry(key, e.id)}>
                        <div className="entry" style={{ padding: "8px 0" }}>
                          <button
                            className="grow dim" style={{ fontSize: 13, textAlign: "left" }}
                            onClick={() => setEditingEntry(e)}
                            aria-label={`Edit ${e.name}`}
                          >
                            {e.name} <span className="faint">· {e.amount} {e.unit}</span>
                          </button>
                          <span className="tnum dim" style={{ fontSize: 12.5 }}>{r0(e.kcal)} kcal</span>
                          <button className="icon-btn" aria-label={`Remove ${e.name}`} onClick={() => removeEntry(key, e.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </SwipeRow>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {orphans.length > 0 && (
        <div className="note warn" style={{ marginTop: 14 }}>
          <b>{orphans.length} item{orphans.length === 1 ? "" : "s"} without a meal.</b> They still count
          toward today's totals. Open the schedule to give them a home.
        </div>
      )}

      <button
        className="btn btn-ghost btn-wide" style={{ marginTop: 8 }}
        onClick={() => setScheduling(true)}
      >
        <Clock3 size={15} /> {t("today.mealsADay", { n: profile.slots.length })}
      </button>

      {/* ── the follow-up ── */}
      <div className="sect">
        <CheckIn dateKey={key} />
        <button className="btn-ghost" style={{ paddingLeft: 0, marginTop: 4 }} onClick={() => onGo("stats")}>
          {t("today.seeConsistency")} <ChevronRight size={16} />
        </button>
      </div>

      {/* ── session ── */}
      <div className="sect">
        <div className="sect-h"><h2 className="h3">{wo ? t("today.session") : t("today.restDay")}</h2></div>
        <button className="glass" style={{ width: "100%", textAlign: "left", display: "block" }} onClick={() => onGo("training")}>
          <div className="row">
            <span style={{ color: "var(--accent-text)" }}>{wo ? <Play size={22} /> : <Moon size={22} />}</span>
            <span className="grow">
              <span className="h4" style={{ display: "block" }}>{wo ? wo.name : "No session scheduled"}</span>
              <span className="dim" style={{ fontSize: 13 }}>
                {wo
                  ? `${wo.ex.length} movements · ${sessionTimeFor(key)}`
                  : "Eat the full target anyway — recovery is where it gets built"}
              </span>
            </span>
            <ChevronRight size={20} style={{ color: "var(--outline)" }} />
          </div>
        </button>
      </div>

      {streak > 1 && (
        <div className="note" style={{ marginTop: 18 }}>
          <b>{streak}-day streak.</b> {streak} days running where you kept at least four fifths of what
          you planned — meals eaten and sessions done. Consistency is the whole mechanism.
        </div>
      )}

      {adding && <AddSheet dateKey={key} slot={adding} onClose={() => setAdding(null)} />}
      {editingEntry && (
        <EntryEditor dateKey={key} entry={editingEntry} onClose={() => setEditingEntry(null)} />
      )}
      {copying && <CopyDaySheet dateKey={key} onClose={() => setCopying(false)} />}
      {scheduling && <MealScheduleSheet onClose={() => setScheduling(false)} />}
      {planning && <Planner onClose={() => setPlanning(false)} />}
    </div>
  );
}
