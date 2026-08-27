import React, { useEffect, useState } from "react";
import { Hourglass, Info } from "lucide-react";
import { useStore, fastingState } from "../lib/store.js";

const pad = n => String(n).padStart(2, "0");

function span(ms) {
  if (ms == null) return "—";
  const mins = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(mins / 60)}h ${pad(mins % 60)}m`;
}

const clock = ts => (ts ? `${pad(new Date(ts).getHours())}:${pad(new Date(ts).getMinutes())}` : "—");

/**
 * The eating window, computed from when things were actually logged.
 *
 * There is deliberately no start/stop button. A fasting timer you have to
 * remember to press is a fasting timer that is wrong — the log already knows
 * when you last ate.
 */
export default function FastingCard() {
  useStore(s => s.log);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const f = fastingState();

  if (!f.lastMealAt) {
    return (
      <div className="card-sm">
        <div className="row">
          <Hourglass size={19} style={{ color: "var(--accent-text)" }} />
          <span className="grow">
            <span className="caps faint" style={{ display: "block", fontSize: 10 }}>Eating window</span>
            <span className="dim" style={{ display: "block", fontSize: 13, marginTop: 5 }}>
              Log a meal and this fills in on its own.
            </span>
          </span>
        </div>
      </div>
    );
  }

  const hours = f.fastingMs / 3600000;

  return (
    <div className="card-sm">
      <div className="row">
        <Hourglass size={19} style={{ color: "var(--accent-text)" }} />
        <span className="grow">
          <span className="caps faint" style={{ display: "block", fontSize: 10 }}>Since your last meal</span>
          <span className="stat-sm" style={{ display: "block", marginTop: 5 }}>{span(f.fastingMs)}</span>
        </span>
        <span className="v" style={{ textAlign: "right" }}>
          <span className="stat-sm tnum">{span(f.windowMs)}</span>
          <span className="d">window today</span>
        </span>
      </div>

      <div className="dim" style={{ fontSize: 12, marginTop: 12 }}>
        First at {clock(f.firstMealAt)} · last at {clock(f.lastMealAt)} · {f.meals} logged today
      </div>

      <p className="note" style={{ marginTop: 12 }}>
        <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
        {hours >= 14
          ? <>Over {Math.floor(hours)} hours since you last ate. On a build that's a long time to go without — the surplus has to fit somewhere.</>
          : hours >= 4
            ? <>Normal spacing between meals. Nothing to do.</>
            : <>You've eaten recently. Timing matters far less than the daily total; eat when you're hungry.</>}
      </p>
    </div>
  );
}
