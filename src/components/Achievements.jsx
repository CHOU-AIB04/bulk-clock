import React, { useState } from "react";
import { Medal, Lock, Info } from "lucide-react";
import { useStore } from "../lib/store.js";
import { computeAchievements } from "../lib/achievements.js";

const STAR = "★";

/**
 * Five tiers per family, shown as filled stars. Nothing here expires or can be
 * lost — an achievement is a record of something that happened, and things that
 * happened stay happened.
 */
export default function Achievements() {
  const state = useStore();
  const [showAll, setShowAll] = useState(false);
  const { earned, next, all } = computeAchievements(state);

  const shown = showAll ? all : [...earned, ...next.filter(t => t.level === 0).slice(0, 3)];

  return (
    <div>
      <div className="card-sm" style={{ marginBottom: 14 }}>
        <div className="row">
          <Medal size={19} style={{ color: "var(--accent-text)" }} />
          <span className="grow">
            <span className="caps faint" style={{ display: "block", fontSize: 10 }}>Earned</span>
            <span className="stat-sm" style={{ display: "block", marginTop: 5 }}>
              {earned.reduce((n, t) => n + t.level, 0)}
              <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}> of {all.reduce((n, t) => n + t.max, 0)}</span>
            </span>
          </span>
        </div>
      </div>

      {shown.length === 0 && (
        <div className="empty">
          <span className="empty-ico"><Medal size={24} /></span>
          Nothing yet. Log a day or a session and the first ones appear.
        </div>
      )}

      {shown.map(t => (
        <div className="card-sm" key={t.id} style={{ marginBottom: 9, opacity: t.level === 0 ? 0.72 : 1 }}>
          <div className="row" style={{ alignItems: "baseline" }}>
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="h4" style={{ display: "block" }}>
                {t.level === 0 ? <Lock size={13} style={{ verticalAlign: -1, marginRight: 6, color: "var(--outline)" }} /> : null}
                {t.level > 0 ? t.title : t.nextTitle}
              </span>
              <span className="dim" style={{ display: "block", fontSize: 12, marginTop: 3 }}>{t.family}</span>
            </span>
            <span
              className="tnum"
              style={{ fontSize: 13, letterSpacing: "0.12em", color: "var(--accent-text)", flex: "0 0 auto" }}
              aria-label={`${t.level} of ${t.max} tiers`}
            >
              {STAR.repeat(t.level)}
              <span style={{ color: "var(--outline-variant)" }}>{STAR.repeat(t.max - t.level)}</span>
            </span>
          </div>

          {t.next != null && (
            <>
              <div className="bar" style={{ marginTop: 10, height: 5 }}>
                <i style={{ width: `${t.progress * 100}%` }} />
              </div>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
                {t.remaining > 0
                  ? `${t.remaining.toLocaleString()} to go for “${t.nextTitle}”`
                  : `“${t.nextTitle}” unlocked`}
              </div>
            </>
          )}
        </div>
      ))}

      <button className="btn btn-ghost btn-wide" style={{ marginTop: 6 }} onClick={() => setShowAll(v => !v)}>
        {showAll ? "Show fewer" : `Show all ${all.length} families`}
      </button>

      <p className="note" style={{ marginTop: 14 }}>
        <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
        These are computed from your log, so they can never be out of step with it — and none of
        them can be lost. A missed day costs you nothing here.
      </p>
    </div>
  );
}
