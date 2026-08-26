import React, { useMemo, useState } from "react";
import {
  Sparkles, ArrowRight, ChevronLeft, Check, Dumbbell, Flame, Target,
  Briefcase, Footprints, Activity, Zap, Clock, Utensils
} from "lucide-react";
import {
  OBJECTIVES, ACTIVITIES, computeTargets, weeksToGoal, mealSchedule,
  balanceMacros, macrosReconcile
} from "../lib/targets.js";
import { completeOnboarding, skipOnboarding } from "../lib/store.js";

const ACT_ICON = { sed: Briefcase, light: Footprints, mod: Activity, high: Zap };
const OBJ_ICON = { build: Dumbbell, lose: Flame, maintain: Target };

function Steps({ n, of }) {
  return (
    <div className="steps" role="progressbar" aria-valuenow={n} aria-valuemin={1} aria-valuemax={of}>
      {Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
    </div>
  );
}

function Bio({ label, value, unit, onChange, min, max }) {
  return (
    <label className="bio">
      <span className="grow">
        <span className="bio-lab">{label}</span>
        <input
          type="number" inputMode="numeric" value={value} min={min} max={max}
          onChange={e => onChange(e.target.value)} aria-label={label}
        />
      </span>
      <span className="bio-unit">{unit}</span>
    </label>
  );
}

/**
 * Three screens, and an escape hatch on every one of them.
 *
 * Nothing here is required to use the app: skipping lands you on a working
 * dashboard with default targets, a default meal schedule and a default
 * training week, all of which are editable from the app itself. Onboarding
 * exists to make the numbers yours, not to gate entry.
 */
export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [p, setP] = useState({
    sex: "male", age: 22, height: 165, weight: 52, goalWeight: 62,
    objective: "build", archetype: "meso", activity: "sed",
    trainingDays: 4, wakeTime: "08:30", mealCount: 4
  });
  const set = patch => setP({ ...p, ...patch });

  const clean = useMemo(() => ({
    ...p,
    age: Number(p.age) || 0, height: Number(p.height) || 0,
    weight: Number(p.weight) || 0, goalWeight: Number(p.goalWeight) || 0
  }), [p]);

  const [override, setOverride] = useState(null);
  const computed = useMemo(() => computeTargets(clean), [clean]);
  const targets = override || computed;
  const weeks = weeksToGoal(clean);
  const slots = useMemo(() => mealSchedule(p.wakeTime, p.mealCount), [p.wakeTime, p.mealCount]);

  const bioValid = clean.age >= 14 && clean.age <= 90 && clean.height >= 120 && clean.height <= 230
    && clean.weight >= 30 && clean.weight <= 250 && clean.goalWeight >= 30 && clean.goalWeight <= 250;

  const Skip = () => (
    <button className="btn btn-ghost btn-wide" style={{ marginTop: 8 }} onClick={skipOnboarding}>
      Skip — I'll set this up later
    </button>
  );

  /* ── 1 · welcome ── */
  if (step === 1) {
    return (
      <div className="scroll">
        <div className="page" style={{ paddingTop: "calc(52px + env(safe-area-inset-top))" }}>
          <div className="badge solid" style={{ marginBottom: 22 }}><Sparkles size={13} /> Bulk Clock</div>
          <h1 className="h1">Built around<br />your numbers.</h1>
          <p className="body-lg dim" style={{ marginTop: 16, maxWidth: "32ch" }}>
            Three quick screens and you get a calorie target, a macro split and a training week —
            all of it editable afterwards, none of it locked.
          </p>

          <div className="glass lit" style={{ marginTop: 30 }}>
            <div className="caps neon" style={{ marginBottom: 12 }}>What you get</div>
            {[
              [Flame, "A calorie and protein target from your own biometrics"],
              [Utensils, "Your own meals, your own foods, your own portions"],
              [Dumbbell, "A training week you build yourself — or load and edit"],
              [Clock, "Reminders that fire on your phone, offline"]
            ].map(([Ico, text], i) => (
              <div className="row top" key={i} style={{ marginBottom: i < 3 ? 13 : 0 }}>
                <span style={{ color: "var(--accent-text)", flex: "0 0 auto", marginTop: 2 }}><Ico size={18} /></span>
                <span style={{ fontSize: 14 }}>{text}</span>
              </div>
            ))}
          </div>

          <p className="note" style={{ marginTop: 22 }}>
            Everything stays on this phone. No account, no server, nothing uploaded — which also
            means <b>nothing is backed up for you</b>.
          </p>

          <button className="btn btn-primary btn-wide" style={{ marginTop: 24 }} onClick={() => setStep(2)}>
            Set my targets <ArrowRight size={18} />
          </button>
          <Skip />
        </div>
      </div>
    );
  }

  /* ── 2 · the numbers ── */
  if (step === 2) {
    return (
      <div className="scroll">
        <div className="page" style={{ paddingTop: "calc(20px + env(safe-area-inset-top))" }}>
          <div className="row">
            <button className="btn-ghost" onClick={() => setStep(1)} aria-label="Back"><ChevronLeft size={22} /></button>
            <span className="caps faint" style={{ marginLeft: "auto" }}>Step 2 of 3</span>
          </div>
          <Steps n={2} of={3} />

          <h2 className="h2">Your numbers</h2>
          <p className="dim" style={{ marginTop: 8, marginBottom: 20 }}>
            These drive the whole calculation, so measure rather than guess where you can.
          </p>

          <div className="chips" style={{ marginBottom: 14 }}>
            {[["male", "Male"], ["female", "Female"]].map(([id, l]) => (
              <button key={id} className="chip chip-outline" aria-pressed={p.sex === id} onClick={() => set({ sex: id })}>{l}</button>
            ))}
          </div>

          <Bio label="Age" value={p.age} unit="Years" min={14} max={90} onChange={v => set({ age: v })} />
          <div className="grid2">
            <Bio label="Weight" value={p.weight} unit="Kg" min={30} max={250} onChange={v => set({ weight: v })} />
            <Bio label="Height" value={p.height} unit="Cm" min={120} max={230} onChange={v => set({ height: v })} />
          </div>

          <h3 className="h3" style={{ marginTop: 26, marginBottom: 14 }}>What are you after</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {OBJECTIVES.map(o => {
              const Ico = OBJ_ICON[o.id];
              return (
                <button key={o.id} className="pick" aria-pressed={p.objective === o.id} onClick={() => set({ objective: o.id })}>
                  <span className="pick-ico"><Ico size={21} /></span>
                  <span className="grow">
                    <span className="pick-t">{o.label}</span>
                    <span className="pick-d">{o.desc}</span>
                  </span>
                  <span className="pick-mark">{p.objective === o.id ? <Check size={20} /> : null}</span>
                </button>
              );
            })}
          </div>

          <h3 className="h3" style={{ marginTop: 26, marginBottom: 12 }}>Goal weight</h3>
          <Bio label="Target" value={p.goalWeight} unit="Kg" min={30} max={250} onChange={v => set({ goalWeight: v })} />
          {bioValid && weeks && (
            <p className="note">
              <b>{Math.abs(clean.goalWeight - clean.weight).toFixed(1)} kg to go.</b> At the pace this
              objective implies that's roughly <b>{weeks} weeks</b> — about {Math.round(weeks / 4.3)} months
              of consistent execution.
            </p>
          )}

          <h3 className="h3" style={{ marginTop: 26, marginBottom: 12 }}>Day-to-day movement</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {ACTIVITIES.map(a => {
              const Ico = ACT_ICON[a.id];
              return (
                <button key={a.id} className="pick" aria-pressed={p.activity === a.id} onClick={() => set({ activity: a.id })}>
                  <span className="pick-ico"><Ico size={21} /></span>
                  <span className="grow">
                    <span className="pick-t">{a.label}</span>
                    <span className="pick-d">{a.desc}</span>
                  </span>
                  <span className="pick-mark">{p.activity === a.id ? <Check size={20} /> : null}</span>
                </button>
              );
            })}
          </div>

          <h3 className="h3" style={{ marginTop: 26, marginBottom: 12 }}>Training days a week</h3>
          <div className="chips">
            {[2, 3, 4, 5, 6].map(n => (
              <button key={n} className="chip" aria-pressed={p.trainingDays === n} onClick={() => set({ trainingDays: n })}>{n} days</button>
            ))}
          </div>

          {!bioValid && <p className="note danger" style={{ marginTop: 18 }}>Check your age, height and weight — one of them is outside a plausible range.</p>}

          <button className="btn btn-primary btn-wide" style={{ marginTop: 24 }} disabled={!bioValid} onClick={() => setStep(3)}>
            See my targets <ArrowRight size={18} />
          </button>
          <Skip />
        </div>
      </div>
    );
  }

  /* ── 3 · the targets ── */
  const obj = OBJECTIVES.find(o => o.id === p.objective);
  // Editing one number rebalances the rest, so the four always describe one diet.
  const editTarget = (k, v) => setOverride(balanceMacros(targets, k, v));
  const recon = macrosReconcile(targets);

  return (
    <div className="scroll">
      <div className="page" style={{ paddingTop: "calc(20px + env(safe-area-inset-top))" }}>
        <div className="row">
          <button className="btn-ghost" onClick={() => setStep(2)} aria-label="Back"><ChevronLeft size={22} /></button>
          <span className="caps faint" style={{ marginLeft: "auto" }}>Step 3 of 3</span>
        </div>
        <Steps n={3} of={3} />

        <h2 className="h2">Your targets</h2>
        <p className="dim" style={{ marginTop: 8, marginBottom: 18 }}>
          Calculated with the Mifflin&ndash;St&nbsp;Jeor equation. Overwrite anything you disagree
          with — and change it all later from settings.
        </p>

        <div className="hero">
          <div className="row" style={{ marginBottom: 16, position: "relative", zIndex: 1 }}>
            <div className="grow">
              <div className="caps">Daily calories</div>
              <div className="stat-xl" style={{ marginTop: 8 }}>{targets.kcal}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="caps">{obj.caps}</div>
              <div style={{ fontSize: 13, marginTop: 6, color: "rgba(16,22,10,.66)", fontWeight: 600 }}>{obj.pace}</div>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 18, fontSize: 13, position: "relative", zIndex: 1, color: "rgba(16,22,10,.66)", fontWeight: 600 }}>
            <span>Resting burn <b className="tnum" style={{ color: "var(--on-accent)" }}>{targets.rmr}</b></span>
            <span>Maintenance <b className="tnum" style={{ color: "var(--on-accent)" }}>{targets.tdee}</b></span>
          </div>
        </div>

        <div className="grid-auto" style={{ marginTop: 14 }}>
          {[["Calories", "kcal", ""], ["Protein", "protein", "g"], ["Carbs", "carbs", "g"], ["Fat", "fat", "g"]].map(([label, key, unit]) => (
            <label className="card-sm" key={key}>
              <span className="caps faint">{label}</span>
              <div className="row" style={{ marginTop: 8, gap: 6 }}>
                <input
                  className="input num" style={{ padding: "8px 10px", fontSize: 22 }}
                  type="number" inputMode="numeric" value={targets[key]}
                  onChange={e => editTarget(key, e.target.value)} aria-label={label}
                />
                {unit && <span className="dim" style={{ fontSize: 13 }}>{unit}</span>}
              </div>
            </label>
          ))}
        </div>

        <div className={"note " + (recon.ok ? "" : "warn")} style={{ marginTop: 12 }}>
          {recon.ok
            ? <><b>These add up.</b> Protein, carbs and fat come to {recon.sum} kcal against your {targets.kcal} kcal
                target. Change any one of them and the others move to keep it that way.</>
            : <><b>{recon.sum} kcal from the macros</b> against a {targets.kcal} kcal target
                — {recon.diff > 0 ? "+" : ""}{recon.diff}. Edit any field and it rebalances.</>}
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="caps faint" style={{ marginBottom: 12 }}>Where the calories sit</div>
          <div className="bar split">
            <i style={{ width: `${(targets.protein * 4 / targets.kcal) * 100}%`, background: "var(--accent)" }} />
            <i style={{ width: `${(targets.carbs * 4 / targets.kcal) * 100}%`, background: "var(--info)" }} />
            <i style={{ width: `${(targets.fat * 9 / targets.kcal) * 100}%`, background: "var(--warn)" }} />
          </div>
          <div className="legend">
            <span><i style={{ background: "var(--accent)" }} />Protein {Math.round(targets.protein * 4 / targets.kcal * 100)}%</span>
            <span><i style={{ background: "var(--info)" }} />Carbs {Math.round(targets.carbs * 4 / targets.kcal * 100)}%</span>
            <span><i style={{ background: "var(--warn)" }} />Fat {Math.round(targets.fat * 9 / targets.kcal * 100)}%</span>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <Utensils size={18} style={{ color: "var(--accent-text)" }} />
            <span className="caps faint">How many meals a day</span>
          </div>
          <div className="chips">
            {[2, 3, 4, 5, 6, 7, 8].map(n => (
              <button key={n} className="chip" aria-pressed={p.mealCount === n} onClick={() => set({ mealCount: n })}>{n}</button>
            ))}
          </div>

          <div className="card-sm" style={{ marginTop: 14 }}>
            {slots.map(s2 => (
              <div className="entry" key={s2.id} style={{ padding: "9px 0" }}>
                <Clock size={14} style={{ color: "var(--accent-text)", flex: "0 0 auto" }} />
                <span className="grow" style={{ fontSize: 13.5 }}>{s2.name}</span>
                <span className="tnum dim" style={{ fontSize: 13.5 }}>{s2.time}</span>
              </div>
            ))}
          </div>

          <p className="dim" style={{ fontSize: 13, marginTop: 14, marginBottom: 0 }}>
            Starting at {slots[0].time}, three hours apart. This is only a first draft — the number of
            meals, their names and their times are all editable at any time, and nothing in the app
            assumes there are four.
          </p>
        </div>

        <p className="note warn" style={{ marginTop: 14 }}>
          <b>These are estimates, not prescriptions.</b> Mifflin&ndash;St&nbsp;Jeor lands within about
          10% for most people. Your own results over two or three weeks are the real calibration.
        </p>

        <button
          className="btn btn-primary btn-wide" style={{ marginTop: 20 }}
          onClick={() => completeOnboarding(clean, targets, slots)}
        >
          Start using the app <ArrowRight size={18} />
        </button>
        <Skip />
      </div>
    </div>
  );
}
