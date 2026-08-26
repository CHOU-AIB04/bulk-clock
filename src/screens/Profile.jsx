import React, { useEffect, useState } from "react";
import {
  X, Bell, BellRing, BellOff, Clock, Target, Database, RotateCcw, Check,
  Moon, Sun, SunMoon, Plus, Trash2, Scale, Droplets
} from "lucide-react";
import {
  useStore, setSetting, setProfile, exportJSON, replaceState, update,
  resetEverything, allFoods, newId
} from "../lib/store.js";
import { rescheduleAll, testNotification, cancelAll, pendingCount, isNative } from "../lib/notify.js";
import { computeTargets, OBJECTIVES, balanceMacros, macrosReconcile } from "../lib/targets.js";
import { PhotoPicker } from "../components/Photo.jsx";
import MealScheduleSheet from "../components/MealScheduleSheet.jsx";

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

  useEffect(() => { pendingCount().then(setPending); }, [settings]);

  // Any change to reminder settings or meal times rewrites the whole schedule.
  useEffect(() => {
    if (!isNative()) return;
    rescheduleAll(state).then(r => { if (r.ok) pendingCount().then(setPending); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.notifyMeals, settings.notifyTraining, settings.notifyWeighIn,
    settings.notifyRestDay, settings.trainingTime, settings.weighInTime,
    JSON.stringify(profile.slots)
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
        <h2 className="h2 grow">Settings</h2>
        <button className="btn btn-icon btn-quiet" onClick={onClose} aria-label="Close settings"><X size={20} /></button>
      </div>

      <div className="field">
        <span className="lab">Profile picture</span>
        <PhotoPicker
          id={profile.photo} onChange={photo => setProfile({ photo })}
          size="avatar" shape="round" label="Add a picture" replaceLabel="Change picture"
        />
      </div>

      <label className="field">
        <span className="lab">Your name</span>
        <input
          className="input" value={profile.name} placeholder="Optional"
          onChange={e => setProfile({ name: e.target.value })}
        />
      </label>

      {/* ── appearance ── */}
      <div className="sect-h" style={{ marginTop: 26 }}>
        <h2 className="h3">Appearance</h2>
      </div>
      <div className="seg">
        {[["dark", "Dark", Moon], ["light", "Light", Sun], ["system", "System", SunMoon]].map(([id, label, Ico]) => (
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
        <h2 className="h3">Reminders</h2>
        <span className="badge">{isNative() ? (pending == null ? "…" : `${pending} scheduled`) : "app only"}</span>
      </div>
      <div className="card">
        {!isNative() && (
          <p className="note warn" style={{ marginBottom: 16 }}>
            <b>Running in a browser.</b> Device reminders only fire in the installed APK.
          </p>
        )}
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
            flash(await testNotification() ? "Test fires in 10 seconds." : "Only works in the installed app.");
          }}><Bell size={15} /> Test</button>
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

        <p className="note warn" style={{ marginTop: 12 }}>
          <b>Android will delay these unless you allow it.</b> Settings → Apps → Bulk Clock → Battery →
          Unrestricted. Without that, reminders drift once the phone sits idle.
        </p>
      </div>

      {/* ── meal times ── */}
      <div className="sect-h" style={{ marginTop: 28 }}>
        <h2 className="h3">Meal schedule</h2>
        <span className="caps faint"><Clock size={12} style={{ verticalAlign: -2 }} /> {profile.slots.length} meals</span>
      </div>
      <div className="card">
        <button className="btn btn-primary btn-wide" style={{ marginBottom: 16 }} onClick={() => setScheduling(true)}>
          <Clock size={16} /> Open the schedule editor
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
        <h2 className="h3">Targets</h2>
        <span className="badge"><Target size={12} /> {obj?.caps}</span>
      </div>
      <div className="card">
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

        {[["weight", "Current weight", "kg"], ["goalWeight", "Goal weight", "kg"]].map(([k, label, unit]) => (
          <div className="row" key={k} style={{ marginBottom: 10, gap: 10 }}>
            <span className="grow" style={{ fontSize: 14.5 }}>{label}{unit ? ` (${unit})` : ""}</span>
            <input
              className="input num" style={{ flex: "0 0 120px" }} type="number" inputMode="decimal"
              value={profile[k]} onChange={e => setProfile({ [k]: Number(e.target.value) || 0 })}
              aria-label={label}
            />
          </div>
        ))}
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
        <h2 className="h3">Your data</h2>
        <span className="caps faint"><Database size={12} style={{ verticalAlign: -2 }} /> {allFoods().length} foods offline</span>
      </div>
      <div className="card">
        <div className="row wrap" style={{ gap: 10 }}>
          <button className="btn btn-sm btn-primary" onClick={copyBackup}>Copy backup</button>
          <button className="btn btn-sm btn-quiet" onClick={() => setRestoring(r => !r)}>
            {restoring ? "Cancel" : "Restore backup"}
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
          Nothing you log leaves this device — no account, no server. That also means
          <b> nothing is backed up for you</b>. Copy a backup every few weeks.
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

      {msg && (
        <div className="toast">
          <div className="glass lit"><Check size={18} style={{ color: "var(--accent)", flex: "0 0 auto" }} /><span style={{ fontSize: 14 }}>{msg}</span></div>
        </div>
      )}
    </div>
  );
}
