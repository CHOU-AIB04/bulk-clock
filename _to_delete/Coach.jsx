import React from "react";
import { Sparkles, Info, TrendingUp, Beef, Dumbbell, Flame, Activity } from "lucide-react";
import { useStore } from "../lib/store.js";
import { getInsights } from "../lib/insights.js";

const TONE_BADGE = { good: "", warn: "warn", danger: "danger", neutral: "" };
const ICON = {
  ready: Activity, trend: TrendingUp, protein: Beef,
  lift: Dumbbell, streak: Flame, balance: Sparkles
};

export default function Coach() {
  const state = useStore();
  const insights = getInsights(state);

  return (
    <div className="page" style={{ paddingTop: 20 }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <Sparkles size={24} style={{ color: "var(--accent)" }} />
        <h2 className="h2">Coach</h2>
      </div>
      <p className="dim" style={{ marginTop: 0, marginBottom: 20 }}>
        Everything below is computed from what you logged.
      </p>

      <div className="glass" style={{ marginBottom: 20 }}>
        <div className="row top">
          <Info size={18} style={{ color: "var(--accent)", flex: "0 0 auto", marginTop: 2 }} />
          <div>
            <div className="caps neon" style={{ marginBottom: 6 }}>How this works</div>
            <p className="dim" style={{ fontSize: 13.5, margin: 0, lineHeight: 1.55 }}>
              This is arithmetic on your own numbers — weight trend against your target rate, protein
              against your target, top sets across sessions — not a language model. It runs entirely
              on this phone, works offline, and never sends your data anywhere. When there is nothing
              useful to say, it says nothing rather than filling the space.
            </p>
          </div>
        </div>
      </div>

      {insights.length === 0 && (
        <div className="empty">
          Nothing to report yet. Log a few days of meals, weights and sets and this fills in.
        </div>
      )}

      {insights.map(ins => {
        const Ico = ICON[ins.id] || Sparkles;
        return (
          <div className="card" key={ins.id} style={{ marginBottom: 12 }}>
            <div className="row" style={{ marginBottom: 12 }}>
              <span
                style={{
                  width: 40, height: 40, flex: "0 0 40px", borderRadius: "var(--r)",
                  display: "grid", placeItems: "center",
                  background: ins.tone === "danger" ? "var(--danger-bg)" : ins.tone === "warn" ? "var(--warn-bg)" : "var(--accent-a15)",
                  color: ins.tone === "danger" ? "var(--danger)" : ins.tone === "warn" ? "var(--warn)" : "var(--accent)"
                }}
              >
                <Ico size={20} />
              </span>
              <span className={"badge " + TONE_BADGE[ins.tone]} style={{ marginLeft: "auto" }}>{ins.tag}</span>
            </div>
            <div className="h4">{ins.title}</div>
            <p className="dim" style={{ fontSize: 14, marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>{ins.body}</p>
          </div>
        );
      })}

      <p className="note warn" style={{ marginTop: 20 }}>
        <b>General information, not medical advice.</b> These rules assume you're healthy and training
        normally. If something feels wrong — persistent fatigue, unexplained weight change, pain that
        isn't soreness — that's a conversation with a doctor, not an app.
      </p>
    </div>
  );
}
