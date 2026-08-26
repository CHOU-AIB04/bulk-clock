import React, { useState } from "react";
import { Gauge, Check, X, TrendingUp, Info } from "lucide-react";
import { useStore, setProfile, setSetting, todayKey } from "../lib/store.js";
import { estimateTDEE, proposeTargets, MIN_DAYS, MIN_WEIGHINS } from "../lib/adaptive.js";

/**
 * What your maintenance actually is, measured rather than predicted.
 *
 * Deliberately never applies anything on its own. A target that moves without
 * being asked is a target people stop trusting, and the whole value of this is
 * that the reasoning is visible and the decision stays with the user.
 */
export default function AdaptiveTargets() {
  const state = useStore();
  const [dismissed, setDismissed] = useState(false);

  const estimate = estimateTDEE(state);
  const proposal = estimate.ok ? proposeTargets(state, estimate) : null;

  if (!estimate.ok) {
    const daysToGo = Math.max(0, MIN_DAYS - estimate.loggedDays);
    const weighToGo = Math.max(0, MIN_WEIGHINS - estimate.weighIns);
    return (
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <Gauge size={19} style={{ color: "var(--accent-text)" }} />
          <span className="h4 grow">Measuring your maintenance</span>
        </div>
        <p className="dim" style={{ fontSize: 14, margin: 0 }}>
          Your target is still the Mifflin–St&nbsp;Jeor estimate, which is right within about 10% for
          most people. Two weeks of logged days and half a dozen weigh-ins and the app can measure
          the real number from your own energy balance instead.
        </p>
        <div className="grid2" style={{ marginTop: 14 }}>
          <div className="nested">
            <div className="caps faint" style={{ fontSize: 10 }}>Logged days</div>
            <div className="stat-sm" style={{ marginTop: 6 }}>
              {estimate.loggedDays}<span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> / {MIN_DAYS}</span>
            </div>
          </div>
          <div className="nested">
            <div className="caps faint" style={{ fontSize: 10 }}>Weigh-ins</div>
            <div className="stat-sm" style={{ marginTop: 6 }}>
              {estimate.weighIns}<span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> / {MIN_WEIGHINS}</span>
            </div>
          </div>
        </div>
        <p className="dim" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
          {daysToGo > 0 && `${daysToGo} more logged day${daysToGo === 1 ? "" : "s"}`}
          {daysToGo > 0 && weighToGo > 0 && " and "}
          {weighToGo > 0 && `${weighToGo} more weigh-in${weighToGo === 1 ? "" : "s"}`}
          {daysToGo === 0 && weighToGo === 0 && "Nearly there — a longer span between weigh-ins is all that's missing."}
          {(daysToGo > 0 || weighToGo > 0) && " to go."}
        </p>
      </div>
    );
  }

  return (
    <div className={"card" + (proposal && !dismissed ? " " : "")}>
      <div className="row" style={{ marginBottom: 12 }}>
        <Gauge size={19} style={{ color: "var(--accent-text)" }} />
        <span className="h4 grow">Your measured maintenance</span>
        <span className={"badge " + (estimate.quality === "good" ? "" : "warn")}>
          {estimate.confidence}% confident
        </span>
      </div>

      <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
        <span className="stat neon">{estimate.tdee}</span>
        <span className="dim" style={{ fontSize: 14 }}>kcal a day</span>
      </div>

      <div className="grid3" style={{ marginTop: 14 }}>
        <div className="nested">
          <div className="caps faint" style={{ fontSize: 9.5 }}>Avg intake</div>
          <div className="stat-sm" style={{ marginTop: 6 }}>{estimate.avgIntake}</div>
        </div>
        <div className="nested">
          <div className="caps faint" style={{ fontSize: 9.5 }}>Weight/wk</div>
          <div className="stat-sm" style={{ marginTop: 6 }}>
            {estimate.ratePerWeek > 0 ? "+" : ""}{estimate.ratePerWeek}
          </div>
        </div>
        <div className="nested">
          <div className="caps faint" style={{ fontSize: 9.5 }}>Days used</div>
          <div className="stat-sm" style={{ marginTop: 6 }}>{estimate.loggedDays}</div>
        </div>
      </div>

      {proposal && !dismissed ? (
        <>
          <p className="note" style={{ marginTop: 16 }}>
            <b>Suggested: {proposal.kcal} kcal ({proposal.delta > 0 ? "+" : ""}{proposal.delta}).</b>{" "}
            {proposal.reason}
          </p>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button
              className="btn btn-primary grow"
              onClick={() => {
                setProfile({
                  kcalTarget: proposal.kcal,
                  pTarget: proposal.protein,
                  cTarget: proposal.carbs,
                  fTarget: proposal.fat
                });
                setSetting({ lastTdeeCheck: todayKey() });
                setDismissed(true);
              }}
            >
              <Check size={17} /> Use {proposal.kcal}
            </button>
            <button className="btn btn-quiet" onClick={() => setDismissed(true)}>
              <X size={17} /> Keep mine
            </button>
          </div>
        </>
      ) : (
        <p className="note" style={{ marginTop: 16 }}>
          <TrendingUp size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          Your current target of <b>{state.profile.kcalTarget} kcal</b> is consistent with this
          measurement. Nothing to change.
        </p>
      )}

      <p className="dim" style={{ fontSize: 11.5, marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
        <Info size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
        Measured as average intake minus your weight trend, at 7 700 kcal per kilo. Early weight
        change is mostly water, so this gets more reliable the longer you log — and it never changes
        anything without you tapping.
      </p>
    </div>
  );
}
