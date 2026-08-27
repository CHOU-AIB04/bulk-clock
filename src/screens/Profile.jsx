import React, { useEffect, useState } from "react";
import {
  X, Bell, BellRing, BellOff, Clock, Target, Database, RotateCcw, Check,
  Moon, Sun, SunMoon, Plus, Trash2, Scale, Droplets, AlarmClock
} from "lucide-react";
import {
  useStore, setSetting, setProfile, exportJSON, replaceState, update,
  resetEverything, allFoods, newId
} from "../lib/store.js";
import { rescheduleAll, testNotification, cancelAll, pendingCount, isNative } from "../lib/notify.js";
import { computeTargets, OBJECTIVES, balanceMacros, macrosReconcile } from "../lib/targets.js";
import { PhotoPicker } from "../components/Photo.jsx";
import MealScheduleSheet from "../components/MealScheduleSheet.jsx";
import ReminderHealth from "../components/ReminderHealth.jsx";
import ReminderTakeover from "../components/ReminderTakeover.jsx";
import GoalSwitcher from "../components/GoalSwitcher.jsx";
import { exportFile, autoBackup, listBackups, restoreBackup } from "../lib/backup.js";
import { downloadAllPhotos, localPhotoCoverage } from "../lib/photos.js";
import { todaysEvents } from "../lib/reminders.js";
import { weightUnit, toDisplayWeight, fromDisplayWeight, formatHeight } from "../lib/units.js";
import { t, LOCALE_LIST, coverage, detectLocale } from "../lib/i18n.js";

function Toggle({ name, desc, on, onChange }) {
  return (
    <div className="toggle">
      <div className="grow">
        <div style={{ fontWeight: 600, fontSize: 15 }}>{name}</div>
        <div className="dim" style={{ fontSize: 12.5, marginTop: 3 }}>{desc}</div>
      </div>
      <button className="sw" role="switch" aria-checked={on} aria-label={name} onClick={() => onChange(!on)}><i /></button>
    </div>
  );
}

export default function Profile({ onClose }) {
  const state = useStore();
  const { settings, profile } = state;
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [paste, setPaste] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [previewEvent, setPreviewEvent] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [backups, setBackups] = useState([]);
  const [exporting, setExporting] = useState("");
  const [photoJob, setPhotoJob] = useState(null);

  useEffect(() => { listBackups().then(setBackups); }, []);

  async function doExport(kind, label) {
    setExporting(kind);
    const r = await exportFile(kind);
    setExporting("");
    if (r.ok && r.shared) flash(`${label} exported and shared.`);
    else if (r.ok && r.reason === "web") flash(`${label} downloaded.`);
    else if (r.ok) flash(`${label} saved to ${r.path}.`);
    else flash(`Couldn't write the file: ${r.reason}`);
  }

  /**
   * Show the takeover on demand, using a real event from today so what you see
   * is exactly what will appear — the next meal you haven't logged, or the next
   * one on the clock if you've logged them all.
   */
  function previewReminder() {
    const events = todaysEvents().filter(e => e.kind !== "checkin");
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const upcoming = events.find(e => !e.done && e.minutes >= nowMin)
      || events.find(e => !e.done)
      || events.find(e => e.minutes >= nowMin)
      || events[0];

    if (!upcoming) {
      flash("Add a meal to your schedule first — there's nothing to remind you about.");
      return;
    }
    setPreviewEvent({ ...upcoming, deltaMin: upcoming.minutes - nowMin, late: upcoming.minutes < nowMin });
  }

  useEffect(() => { pendingCount().then(setPending); }, [settings]);

  // Any change to reminder settings or meal times rewrites the whole schedule.
  useEffect(() => {
    if (!isNative()) return;
    rescheduleAll(state).then(r => { if (r.ok) pendingCount().then(setPending); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.notifyMeals, settings.notifyTraining, settings.notifyWeighIn,
    settings.notifyRestDay, settings.notifyCheckin, settings.notifyWater,
    settings.trainingTime, settings.weighInTime, settings.checkinTime,
    settings.leadMinutes, settings.trackWeight, settings.notifySupplements,
    JSON.stringify(profile.slots), JSON.stringify(state.program?.days || {}),
    JSON.stringify(state.supplements || [])
  ]);

  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 3000); }

  async function copyBackup() {
    const json = exportJSON();
    try {
      await navigator.clipboard.writeText(json);
      flash(`Backup copied — ${(json.length / 1024).toFixed(0)} KB. Paste it somewhere safe.`);
    } catch {
      setPaste(json); setRestoring(true);
      flash("Clipboard blocked — your data is in the box below, copy it from there.");
    }
  }

  function restore() {
    try {
      const next = JSON.parse(paste);
      if (!next || typeof next !== "object" || !next.profile) throw new Error("not a backup");
      replaceState(next);
      setRestoring(false); setPaste("");
      flash("Restored.");
    } catch {
      flash("That isn't a valid Bulk Clock backup.");
    }
  }

  const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const trainingDayNames = Object.keys(state.program?.days || {})
    .map(Number).sort().map(d => DAY_ABBR[d - 1]).join(", ");

  // The four target numbers are one system, not four independent fields.
  const targetSet = {
    kcal: profile.kcalTarget, protein: profile.pTarget,
    carbs: profile.cTarget, fat: profile.fTarget
  };
  const recon = macrosReconcile(targetSet);
  const TARGET_KEYS = { kcalTarget: "kcal", pTarget: "protein", cTarget: "carbs", fTarget: "fat" };

  function editTarget(profileKey, value) {
    const next = balanceMacros(targetSet, TARGET_KEYS[profileKey], value);
    setProfile({
      kcalTarget: next.kcal, pTarget: next.protein,
      cTarget: next.carbs, fTarget: next.fat
    });
  }

  const recalculated = computeTargets(profile);
  const drifted = recalculated.kcal !== profile.kcalTarget;
  const obj = OBJECTIVES.find(o => o.id === profile.objective);

  return (
    <div className="page" style={{ paddingTop: 20 }}>
      <div className="row" style={{ marginBottom: 20 }}>
        <h2 className="h2 grow">{t("settings.title")}</h2>
        <button className="btn btn-icon btn-quiet" onClick={onClose} aria-label="Close settings"><X size={20} /></button>
      </div>

      <div className="field">
        <span className="lab">{t("settings.picture")}</span>
        <PhotoPicker
          id={profile.photo} onChange={photo => setProfile({ photo })}
          size="avatar" shape="round" label="Add a picture" replaceLabel="Change picture"
        />
      </div>

      <label className="field">
        <span className="lab">{t("settings.name")}</span>
        <input
          className="input" value={profile.name} placeholder="Optional"
          onChange={e => setProfile({ name: e.target.value })}
        />
      </label>

      {/* ── language ── */}
      <div className="sect-h" style={{ marginTop: 26 }}>
        <h2 className="h3">{t("settings.language")}</h2>
      </div>
      <div className="chips">
        <button
          className="chip" aria-pressed={!settings.language}
          onClick={() => setSetting({ language: null })}
        >
          {t("settings.system")}
        </button>
        {LOCALE_LIST.map(l => (
          <button
            key={l.code} className="chip" aria-pressed={settings.language === l.code}
            onClick={() => setSetting({ language: l.code })}
            lang={l.code}
          >
            {l.native}
          </button>
        ))}
      </div>
      {(() => {
        const code = settings.language || detectLocale();
        const cov = coverage(code);
        const l = LOCALE_LIST.find(x => x.code === code);
        return (
          <p className="note" style={{ marginTop: 12 }}>
            {code === "en"
              ? "English is the source language, so everything is written in it."
              : <>
                  <b>{l?.native}</b> covers the interface — navigation, buttons, labels and the
                  reminder screen. The longer explanatory notes are still in English and will be
                  translated as they settle. Nothing shows a blank; untranslated text falls back.
                  {l?.dir === "rtl" && " The whole app lays out right-to-left in Arabic."}
                </>}
          </p>
        );
      })()}

      {/* ── units ── */}
      <div className="sect-h" style={{ marginTop: 26 }}>
        <h2 className="h3">{t("settings.units")}</h2>
      </div>
      <div className="seg">
        {[["metric", "Metric · kg, cm"], ["imperial", "Imperial · lb, in"]].map(([id, label]) => (
          <button key={id} aria-pressed={settings.units === id} onClick={() => setSetting({ units: id })}>
            {label}
          </button>
        ))}
      </div>
      <p className="note" style={{ marginTop: 12 }}>
        Everything is stored in metric and converted only for display, so switching back and forth
        never changes a single number you logged. Food portions stay in grams either way — every
        nutrition label in the world is per 100 g.
      </p>

      {/* ── appearance ── */}
      <div className="sect-h" style={{ marginTop: 26 }}>
        <h2 className="h3">{t("settings.appearance")}</h2>
      </div>
      <div className="seg">
        {[["dark", t("settings.dark"), Moon], ["light", t("settings.light"), Sun], ["system", t("settings.system"), SunMoon]].map(([id, label, Ico]) => (
          <button key={id} aria-pressed={settings.theme === id} onClick={() => setSetting({ theme: id })}>
            <Ico size={15} style={{ verticalAlign: -3, marginRight: 6 }} />{label}
          </button>
        ))}
      </div>
      <p className="note" style={{ marginTop: 12 }}>
        <b>System</b> follows whatever your phone is set to, including its automatic night schedule.
      </p>

      {/* ── reminders ── */}
      <div className="sect-h" style={{ marginTop: 28 }}>
        <h2 className="h3">{t("settings.reminders")}</h2>
        <span className="badge">{isNative() ? (pending == null ? "…" : `${pending} scheduled`) : "app only"}</span>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <ReminderHealth />
      </div>

      <div className="card">
        <Toggle
          name="Meal reminders" desc={profile.slots.map(s => s.time).join(" · ")}
          on={settings.notifyMeals} onChange={v => setSetting({ notifyMeals: v })}
        />
        <Toggle
          name="Training sessions" desc={`${trainingDayNames || "no days set"} at ${settings.trainingTime}`}
          on={settings.notifyTraining} onChange={v => setSetting({ notifyTraining: v })}
        />
        <Toggle
          name="Rest days" desc="Wed, Sat, Sun at 09:00 — still eat the full target"
          on={settings.notifyRestDay} onChange={v => setSetting({ notifyRestDay: v })}
        />
        <Toggle
          name="Supplements"
          desc={state.supplements.length ? `${state.supplements.length} on your list, each at its own time` : "Nothing on your supplement list yet"}
          on={settings.notifySupplements} onChange={v => setSetting({ notifySupplements: v })}
        />
        <Toggle
          name="Water"
          desc="Three nudges through the day if you're behind on your target"
          on={settings.notifyWater} onChange={v => setSetting({ notifyWater: v })}
        />
        <Toggle
          name="Evening check-in" desc={`Ask what actually happened, at ${settings.checkinTime}`}
          on={settings.notifyCheckin} onChange={v => setSetting({ notifyCheckin: v })}
        />
        <Toggle
          name="Weigh-in" desc={settings.trackWeight ? `Every morning at ${settings.weighInTime}` : "Weight tracking is off"}
          on={settings.notifyWeighIn && settings.trackWeight}
          onChange={v => setSetting({ notifyWeighIn: v, trackWeight: v ? true : settings.trackWeight })}
        />

        <div className="sect-h" style={{ marginTop: 22, marginBottom: 12 }}>
          <h2 className="h4"><AlarmClock size={14} style={{ verticalAlign: -2, marginRight: 6 }} />How they arrive</h2>
        </div>

        <button className="btn btn-primary btn-wide" style={{ marginBottom: 16 }} onClick={previewReminder}>
          <AlarmClock size={17} /> Show me the full-screen reminder
        </button>
        <p className="note" style={{ marginBottom: 18 }}>
          <b>When the real one appears:</b> whenever the app is open — or is opened by tapping a
          notification — and a meal or session is due within your lead time. It checks every 20
          seconds and each time you come back to the app. It does <b>not</b> take over a locked
          screen with the app closed; that needs a native Android change, described in
          <b> android/FULL_SCREEN_REMINDERS.md</b>. What does reach you with the app shut is the
          heads-up notification, with the same one-tap answers.
        </p>

        <Toggle
          name="Full-screen reminders"
          desc="Takes over the screen for the meal or session that's due, with one-tap answers — rather than a banner that scrolls away"
          on={settings.fullScreenReminders} onChange={v => setSetting({ fullScreenReminders: v })}
        />

        <div style={{ marginTop: 14 }}>
          <span className="lab">How far ahead</span>
          <div className="chips" style={{ marginTop: 8 }}>
            {[10, 15, 30, 45, 60].map(v => (
              <button
                key={v} className="chip" aria-pressed={settings.leadMinutes === v}
                onClick={() => setSetting({ leadMinutes: v })}
              >
                {v} min
              </button>
            ))}
          </div>
          <p className="note" style={{ marginTop: 14 }}>
            Every meal and session is announced <b>{settings.leadMinutes} minutes ahead</b> as well as
            at the time itself. The early one is the one that changes anything — being told about
            lunch at lunchtime is news, half an hour earlier is a chance to do something about it.
          </p>
        </div>

        <div style={{ marginTop: 16 }}>
          <span className="lab">Snooze length</span>
          <div className="chips" style={{ marginTop: 8 }}>
            {[5, 10, 15, 30].map(v => (
              <button
                key={v} className="chip" aria-pressed={settings.snoozeMinutes === v}
                onClick={() => setSetting({ snoozeMinutes: v })}
              >
                {v} min
              </button>
            ))}
          </div>
        </div>

        <div className="grid2" style={{ marginTop: 16 }}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="lab">Default session time</span>
            <input className="input num" type="time" value={settings.trainingTime} onChange={e => setSetting({ trainingTime: e.target.value })} />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="lab">Check-in time</span>
            <input className="input num" type="time" value={settings.checkinTime} onChange={e => setSetting({ checkinTime: e.target.value })} />
          </label>
        </div>

        <div className="row wrap" style={{ marginTop: 18, gap: 10 }}>
          <button className="btn btn-sm btn-primary" onClick={async () => {
            const r = await rescheduleAll(state);
            flash(r.ok ? `${r.count} reminders scheduled.` : r.reason === "denied" ? "Permission denied — enable notifications in Android settings." : "Reminders need the installed app.");
            pendingCount().then(setPending);
          }}><BellRing size={15} /> Reschedule</button>
          <button className="btn btn-sm btn-quiet" onClick={async () => {
            flash(await testNotification()
              ? "A test notification fires in 10 seconds — try answering it from the shade."
              : "Notifications only fire in the installed app. The full-screen preview below works here too.");
          }}><Bell size={15} /> Test notification</button>
          <button className="btn btn-sm btn-quiet" onClick={async () => { await cancelAll(); setPending(0); flash("All reminders cancelled."); }}>
            <BellOff size={15} /> Cancel all
          </button>
        </div>

        <p className="note" style={{ marginTop: 16 }}>
          <b>What "default session time" means.</b> It's the hour your training reminder fires on a
          day that has no time of its own. Each training day in your programme carries its own time —
          Monday 09:00, Thursday 15:00 — and this is only the fallback for days you never set. To move
          a single session without touching the programme, use <b>“Training at another time today”</b> on
          the Training tab.
        </p>


      </div>

      {/* ── meal times ── */}
      <div className="sect-h" style={{ marginTop: 28 }}>
        <h2 className="h3">{t("settings.mealSchedule")}</h2>
        <span className="caps faint"><Clock size={12} style={{ verticalAlign: -2 }} /> {profile.slots.length} meals</span>
      </div>
      <div className="card">
        <button className="btn btn-primary btn-wide" style={{ marginBottom: 16 }} onClick={() => setScheduling(true)}>
          <Clock size={16} /> {t("settings.openSchedule")}
        </button>
        {profile.slots.map((slot, i) => (
          <div className="row" key={slot.id} style={{ marginBottom: i === profile.slots.length - 1 ? 0 : 10, gap: 10 }}>
            <input
              className="input grow" value={slot.name}
              onChange={e => update(d => { d.profile.slots[i].name = e.target.value; })}
              aria-label={`Meal ${i + 1} name`}
            />
            <input
              className="input num" style={{ flex: "0 0 112px" }} type="time" value={slot.time}
              onChange={e => update(d => { d.profile.slots[i].time = e.target.value; })}
              aria-label={`Meal ${i + 1} time`}
            />
            <button
              className="icon-btn" aria-label={`Remove ${slot.name}`}
              disabled={profile.slots.length <= 1}
              onClick={() => update(d => { d.profile.slots.splice(i, 1); })}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          className="btn btn-sm btn-secondary" style={{ marginTop: 14 }}
          onClick={() => update(d => {
            const last = d.profile.slots[d.profile.slots.length - 1];
            const [h, m] = (last?.time || "08:00").split(":").map(Number);
            const t = (h * 60 + m + 180) % 1440;
            d.profile.slots.push({
              id: `m_${newId()}`,
              name: `Meal ${d.profile.slots.length + 1}`,
              time: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
            });
          })}
        >
          <Plus size={15} /> Add a meal slot
        </button>
        <p className="note" style={{ marginTop: 14 }}>
          These slots are the day the app follows — rename them, retime them, add or delete them.
          There is no fixed number: two meals or eight, whatever your day actually looks like. The
          reminders and the check-in follow this list exactly.
        </p>
      </div>

      {/* ── water ── */}
      <div className="sect-h" style={{ marginTop: 28 }}>
        <h2 className="h3">Water</h2>
        <span className="caps faint"><Droplets size={12} style={{ verticalAlign: -2 }} /> daily</span>
      </div>
      <div className="card">
        <div className="grid2">
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="lab">Daily target (L)</span>
            <input
              className="input num" type="number" inputMode="decimal" step="0.1" min="0.5" max="10"
              value={(settings.waterTargetMl / 1000).toFixed(1)}
              onChange={e => setSetting({ waterTargetMl: Math.round((Number(e.target.value) || 0) * 1000) })}
            />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="lab">Glass size (ml)</span>
            <input
              className="input num" type="number" inputMode="numeric" step="10" min="50" max="2000"
              value={settings.waterGlassMl}
              onChange={e => setSetting({ waterGlassMl: Math.max(50, Number(e.target.value) || 250) })}
            />
          </label>
        </div>
        <p className="note" style={{ marginTop: 14 }}>
          Roughly 35&nbsp;ml per kilo of bodyweight is a common starting point — about{" "}
          <b>{((profile.weight * 35) / 1000).toFixed(1)}&nbsp;L</b> for you, before training sweat.
        </p>
      </div>

      {/* ── weight tracking ── */}
      <div className="sect-h" style={{ marginTop: 28 }}>
        <h2 className="h3">Weight</h2>
        <span className="caps faint"><Scale size={12} style={{ verticalAlign: -2 }} /> optional</span>
      </div>
      <div className="card">
        <Toggle
          name="Track my weight"
          desc="Adds an optional weight field to the daily check-in and turns on the trend chart"
          on={settings.trackWeight} onChange={v => setSetting({ trackWeight: v })}
        />
      </div>

      {/* ── targets ── */}
      <div className="sect-h" style={{ marginTop: 28 }}>
        <h2 className="h3">{t("settings.targets")}</h2>
        <span className="badge"><Target size={12} /> {obj?.caps}</span>
      </div>
      <div className="card">
        <button className="btn btn-secondary btn-wide" style={{ marginBottom: 18 }} onClick={() => setSwitching(true)}>
          <Target size={16} /> {t("settings.changeGoal")}
        </button>

        {[
          ["kcalTarget", "Calories", ""], ["pTarget", "Protein", "g"],
          ["cTarget", "Carbs", "g"], ["fTarget", "Fat", "g"]
        ].map(([k, label, unit]) => (
          <div className="row" key={k} style={{ marginBottom: 10, gap: 10 }}>
            <span className="grow" style={{ fontSize: 14.5 }}>{label}{unit ? ` (${unit})` : ""}</span>
            <input
              className="input num" style={{ flex: "0 0 120px" }} type="number" inputMode="decimal"
              value={profile[k]} onChange={e => editTarget(k, e.target.value)}
              aria-label={label}
            />
          </div>
        ))}

        <p className={"note " + (recon.ok ? "" : "warn")} style={{ margin: "14px 0" }}>
          <b>{recon.sum} kcal</b> from {profile.pTarget} g protein, {profile.cTarget} g carbs
          and {profile.fTarget} g fat.{" "}
          {recon.ok
            ? "That matches your calorie target — edit any one of the four and the others move to keep it matching."
            : `That is ${recon.diff > 0 ? "+" : ""}${recon.diff} kcal against your target. Edit any field to rebalance.`}
        </p>

        {[["weight", "Current weight"], ["goalWeight", "Goal weight"]].map(([k, label]) => (
          <div className="row" key={k} style={{ marginBottom: 10, gap: 10 }}>
            <span className="grow" style={{ fontSize: 14.5 }}>{label} ({weightUnit()})</span>
            <input
              className="input num" style={{ flex: "0 0 120px" }} type="number" inputMode="decimal"
              value={toDisplayWeight(profile[k]) ?? ""}
              onChange={e => setProfile({ [k]: fromDisplayWeight(e.target.value) ?? 0 })}
              aria-label={`${label} in ${weightUnit()}`}
            />
          </div>
        ))}
        <div className="row" style={{ marginBottom: 10, gap: 10 }}>
          <span className="grow" style={{ fontSize: 14.5 }}>Height</span>
          <span className="tnum dim" style={{ fontSize: 14.5 }}>{formatHeight(profile.height)}</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <span className="grow" style={{ fontSize: 14.5 }}>Programme start</span>
          <input
            className="input num" style={{ flex: "0 0 160px" }} type="date"
            value={profile.programStart} onChange={e => setProfile({ programStart: e.target.value })}
            aria-label="Programme start date"
          />
        </div>

        {drifted && (
          <div style={{ marginTop: 16 }}>
            <p className="note" style={{ marginBottom: 10 }}>
              Your biometrics now compute to <b>{recalculated.kcal} kcal</b> and <b>{recalculated.protein} g</b> protein,
              which differs from what's saved. Recalculate only if you want to discard manual edits.
            </p>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setProfile({
                  kcalTarget: recalculated.kcal, pTarget: recalculated.protein,
                  cTarget: recalculated.carbs, fTarget: recalculated.fat
                });
                flash("Targets recalculated from your biometrics.");
              }}
            >
              <RotateCcw size={15} /> Recalculate from biometrics
            </button>
          </div>
        )}
      </div>

      {/* ── how targets behave ── */}
      <div className="sect-h" style={{ marginTop: 28 }}>
        <h2 className="h3">How targets behave</h2>
      </div>
      <div className="card">
        <Toggle
          name="Different targets on training days"
          desc={
            settings.dayTypeTargets
              ? `Training days get about ${Math.round(settings.dayTypeSwing * 100)}% more, rest days give it back. The week totals the same.`
              : "Every day gets the same target"
          }
          on={settings.dayTypeTargets} onChange={v => setSetting({ dayTypeTargets: v })}
        />
        {settings.dayTypeTargets && (
          <div style={{ marginTop: 14 }}>
            <span className="lab">How big the swing is</span>
            <div className="chips" style={{ marginTop: 8 }}>
              {[0.1, 0.15, 0.2, 0.25].map(v => (
                <button
                  key={v} className="chip" aria-pressed={Math.abs(settings.dayTypeSwing - v) < 0.001}
                  onClick={() => setSetting({ dayTypeSwing: v })}
                >
                  {Math.round(v * 100)}%
                </button>
              ))}
            </div>
            <p className="note" style={{ marginTop: 14 }}>
              Only carbohydrate moves — protein and fat stay where they are. Calories are shifted
              between days, never added: a week eats exactly what it did before.
            </p>
          </div>
        )}

        <Toggle
          name="Judge the week, not the day"
          desc="Shows a weekly calorie budget on Today, so a short day can be repaid later in the week"
          on={settings.weeklyBudget} onChange={v => setSetting({ weeklyBudget: v })}
        />
      </div>

      {/* ── data ── */}
      <div className="sect-h" style={{ marginTop: 28 }}>
        <h2 className="h3">{t("settings.yourData")}</h2>
        <span className="caps faint"><Database size={12} style={{ verticalAlign: -2 }} /> {allFoods().length} foods offline</span>
      </div>
      <div className="card">
        <div className="caps faint" style={{ marginBottom: 12 }}>Export a file</div>
        <div className="row wrap" style={{ gap: 10 }}>
          {[
            ["json", "Full backup"],
            ["food", "Food log CSV"],
            ["lifts", "Training CSV"],
            ["body", "Weight & body CSV"]
          ].map(([kind, label]) => (
            <button
              key={kind} className={"btn btn-sm " + (kind === "json" ? "btn-primary" : "btn-quiet")}
              disabled={exporting === kind}
              onClick={() => doExport(kind, label)}
            >
              {exporting === kind ? "Writing…" : label}
            </button>
          ))}
        </div>
        <p className="note" style={{ marginTop: 14 }}>
          Files are written to your <b>Documents</b> folder and handed to the share sheet, so where
          they go — Drive, email, a cable — is entirely your call. The CSVs open in any spreadsheet;
          the JSON is the one that can be restored.
        </p>

        <div className="caps faint" style={{ margin: "20px 0 12px" }}>Automatic backups</div>
        <div className="row wrap" style={{ gap: 10 }}>
          <button
            className="btn btn-sm btn-quiet"
            onClick={async () => {
              const r = await autoBackup(true);
              setBackups(await listBackups());
              flash(r.ok ? "Backup written." : r.reason === "web" ? "Only works in the installed app." : `Couldn't: ${r.reason}`);
            }}
          >
            Back up now
          </button>
          <span className="caps faint" style={{ alignSelf: "center" }}>
            {backups.length ? `${backups.length} kept` : "none yet"}
          </span>
        </div>

        {backups.slice(0, 4).map(b => (
          <div className="entry" key={b.name}>
            <span className="grow dim" style={{ fontSize: 13 }}>{b.name.replace("backup-", "").replace(".json", "")}</span>
            <button
              className="btn btn-sm btn-quiet"
              onClick={async () => {
                const r = await restoreBackup(b.name);
                flash(r.ok ? "Restored from that backup." : `Couldn't restore: ${r.reason}`);
              }}
            >
              Restore
            </button>
          </div>
        ))}

        <p className="note" style={{ marginTop: 14 }}>
          A dated copy is kept on the device once a week, and the last six are retained. It protects
          against clearing the app's data — it does <b>not</b> protect against losing the phone. For
          that, export the JSON somewhere off the device every so often.
        </p>

        <div className="caps faint" style={{ margin: "20px 0 12px" }}>Food photos</div>
        {(() => {
          const cov = localPhotoCoverage(allFoods());
          return (
            <>
              <p className="note" style={{ marginBottom: 12 }}>
                Photos are fetched once from Wikipedia and then kept on the device.
                <b> {cov.local} of {cov.titles}</b> are stored locally so far — the rest fall back to
                their coloured tile until you next open them with a connection.
              </p>
              <button
                className="btn btn-sm btn-quiet"
                disabled={!!photoJob}
                onClick={async () => {
                  setPhotoJob({ done: 0, total: cov.titles, saved: 0 });
                  const r = await downloadAllPhotos(allFoods(), p2 => setPhotoJob(p2));
                  setPhotoJob(null);
                  flash(`${r.saved} of ${r.total} food photos are now stored on the device.`);
                }}
              >
                {photoJob ? `Downloading ${photoJob.done} / ${photoJob.total}…` : "Download them all now"}
              </button>
              {photoJob && (
                <div className="bar" style={{ marginTop: 12, height: 6 }}>
                  <i style={{ width: `${photoJob.total ? (photoJob.done / photoJob.total) * 100 : 0}%` }} />
                </div>
              )}
              <p className="dim" style={{ fontSize: 11.5, marginTop: 10 }}>
                A few megabytes over Wi-Fi, once. After that the database is fully illustrated with
                no connection at all.
              </p>
            </>
          );
        })()}

        <div className="caps faint" style={{ margin: "20px 0 12px" }}>Paste a backup back in</div>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className="btn btn-sm btn-quiet" onClick={copyBackup}>Copy to clipboard</button>
          <button className="btn btn-sm btn-quiet" onClick={() => setRestoring(r => !r)}>
            {restoring ? "Cancel" : "Paste and restore"}
          </button>
        </div>
        {restoring && (
          <>
            <textarea
              className="input" rows={6} style={{ marginTop: 14, fontSize: 11, fontFamily: "monospace" }}
              value={paste} onChange={e => setPaste(e.target.value)} placeholder="Paste a Bulk Clock backup here…"
            />
            <button className="btn btn-primary btn-wide" style={{ marginTop: 10 }} disabled={!paste.trim()} onClick={restore}>
              Replace everything with this backup
            </button>
          </>
        )}
        <p className="note" style={{ marginTop: 16 }}>
          Nothing you log leaves this device — no account, no server, no analytics. The flip side is
          that <b>no one else has a copy</b>.
        </p>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        {!confirmReset ? (
          <button className="btn btn-danger btn-wide" onClick={() => setConfirmReset(true)}>
            Reset app and redo setup
          </button>
        ) : (
          <>
            <p className="note danger" style={{ marginBottom: 12 }}>
              <b>This erases everything</b> — every logged meal, weight, set and challenge — and returns
              you to the setup questions. Copy a backup first if you might want it back.
            </p>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-danger grow" onClick={resetEverything}>
                <Check size={17} /> Yes, erase everything
              </button>
              <button className="btn btn-quiet" onClick={() => setConfirmReset(false)}>Keep my data</button>
            </div>
          </>
        )}
      </div>

      <p className="note" style={{ marginTop: 24 }}>
        Food values are per 100 g from standard composition tables; Moroccan dishes are typical
        home-cooked averages. Scanned products come from Open Food Facts and need internet.
        This is general nutrition and training information, not medical advice.
      </p>

      {scheduling && <MealScheduleSheet onClose={() => setScheduling(false)} />}

      {switching && <GoalSwitcher onClose={() => setSwitching(false)} />}

      {previewEvent && (
        <ReminderTakeover event={previewEvent} preview onClose={() => setPreviewEvent(null)} />
      )}

      {msg && (
        <div className="toast" role="status" aria-live="polite">
          <div className="glass lit"><Check size={18} style={{ color: "var(--accent)", flex: "0 0 auto" }} /><span style={{ fontSize: 14 }}>{msg}</span></div>
        </div>
      )}
    </div>
  );
}
