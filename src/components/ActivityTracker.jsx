import React, { useEffect, useRef, useState } from "react";
import {
  Play, Pause, Square, X, Satellite, AlertTriangle, Mountain,
  Flame, Timer, Gauge, MapPin
} from "lucide-react";
import {
  useStore, liveStats, pushPoint, pauseActivity, resumeActivity,
  finishActivity, discardActivity
} from "../lib/store.js";
import { watch, signalOf, isSupported } from "../lib/geo.js";
import { typeOf, formatDuration, formatDistance, formatPace } from "../lib/activity.js";
import { isImperial } from "../lib/units.js";
import { startLive, updateLive, stopLive } from "../lib/liveActivity.js";
import { tapMedium, celebrate } from "../lib/haptics.js";
import RouteMap from "./RouteMap.jsx";

/**
 * The screen you look at mid-run.
 *
 * Two rules shaped it. Everything that matters is readable at arm's length while
 * moving, so one number is enormous and the rest are secondary. And nothing here
 * can lose the recording: the track lives in the persisted store, the foreground
 * service keeps the process alive with the screen off, and finishing is a
 * deliberate two-step rather than a button you can brush past.
 */
export default function ActivityTracker({ onClose, onFinished }) {
  const live = useStore(s => s.live);
  const [, tick] = useState(0);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState("");
  const [confirmStop, setConfirmStop] = useState(false);
  const stopWatch = useRef(null);

  const type = typeOf(live?.type);
  const stats = liveStats();
  const imperial = isImperial();

  // A clock that keeps its own time; the track updates on its own schedule.
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // GPS, and the foreground service that keeps it running with the screen off.
  useEffect(() => {
    if (!live) return;
    if (!type.gps) return;

    if (!isSupported()) {
      setError("This device has no location services, so distance can't be recorded. The timer still works.");
      return;
    }

    stopWatch.current = watch(
      point => {
        setAccuracy(point.acc);
        setError("");
        pushPoint(point);
      },
      err => setError(err.message)
    );

    return () => {
      stopWatch.current?.();
      stopWatch.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.id, type.gps]);

  // Keep the lock-screen card in step with the numbers on screen.
  useEffect(() => {
    if (!live || !stats) return;
    updateLive({
      title: `${type.label} · ${formatDuration(stats.movingMs)}`,
      text: type.gps
        ? `${formatDistance(stats.distanceM, imperial)} · ${paceLabel(stats, type, imperial)}`
        : `${stats.calories} kcal estimated`,
      paused: stats.paused
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor((stats?.movingMs || 0) / 5000), Math.round(stats?.distanceM || 0), stats?.paused]);

  if (!live || !stats) return null;

  const signal = type.gps ? signalOf(accuracy) : "good";

  function finish() {
    stopWatch.current?.();
    stopLive();
    const record = finishActivity();
    celebrate();
    onFinished?.(record);
    onClose();
  }

  function discard() {
    stopWatch.current?.();
    stopLive();
    discardActivity();
    onClose();
  }

  return (
    <div className="live-shell">
      <div className="live-in">
        <div className="row" style={{ marginBottom: 26 }}>
          <span className="badge solid">
            <span className={"gps-dot " + (stats.paused ? "weak" : "good") + (stats.paused ? "" : " recording-dot")} />
            {stats.paused ? "Paused" : "Recording"}
          </span>
          <span className="grow" />
          {type.gps && (
            <span className="badge" title={accuracy ? `±${Math.round(accuracy)} m` : "Waiting for a fix"}>
              <Satellite size={12} />
              {signal === "good" ? "GPS good" : signal === "weak" ? "GPS weak" : "No fix"}
            </span>
          )}
        </div>

        <div className="caps faint">{type.label}</div>

        {type.gps ? (
          <>
            {/* The unit comes from the formatter, not from a guess: under a
                kilometre it reports metres, and labelling that "kilometres"
                made an 89 m warm-up look like an ultramarathon. */}
            <div className="live-primary neon">{formatDistance(stats.distanceM, imperial).split(" ")[0]}</div>
            <div className="dim" style={{ fontSize: 15, marginTop: 4 }}>
              {UNIT_NAMES[formatDistance(stats.distanceM, imperial).split(" ")[1]] || ""}
            </div>
          </>
        ) : (
          <>
            <div className="live-primary neon">{formatDuration(stats.movingMs)}</div>
            <div className="dim" style={{ fontSize: 15, marginTop: 4 }}>moving time</div>
          </>
        )}

        <div className="live-grid" style={{ marginTop: 26 }}>
          <div className="live-stat">
            <div className="caps faint" style={{ fontSize: 9.5 }}>
              <Timer size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Time
            </div>
            <div className="v">{formatDuration(stats.movingMs)}</div>
          </div>
          <div className="live-stat">
            <div className="caps faint" style={{ fontSize: 9.5 }}>
              <Gauge size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
              {type.id === "cycle" ? "Speed" : "Pace"}
            </div>
            <div className="v">{paceLabel(stats, type, imperial)}</div>
          </div>
          <div className="live-stat">
            <div className="caps faint" style={{ fontSize: 9.5 }}>
              <Flame size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Burned
            </div>
            <div className="v">{stats.calories}</div>
          </div>
        </div>

        {type.gps && (
          <>
            <div className="live-grid" style={{ marginTop: 10, gridTemplateColumns: "1fr 1fr" }}>
              <div className="live-stat">
                <div className="caps faint" style={{ fontSize: 9.5 }}>
                  <Mountain size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Elevation
                </div>
                <div className="v">{Math.round(stats.elevationM)} m</div>
              </div>
              <div className="live-stat">
                <div className="caps faint" style={{ fontSize: 9.5 }}>
                  <MapPin size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Fixes
                </div>
                <div className="v">{stats.fixes}</div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <RouteMap points={stats.points} height={190} />
            </div>
          </>
        )}

        {error && (
          <p className="note warn" style={{ marginTop: 14 }}>
            <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
            {error}
          </p>
        )}

        {type.gps && stats.fixes === 0 && !error && (
          <p className="note" style={{ marginTop: 14 }}>
            Waiting for the first fix. GPS needs a view of the sky — under a roof this can take a
            minute, or never arrive. The timer is already running either way.
          </p>
        )}

        <div style={{ height: 20 }} />

        {confirmStop ? (
          <>
            <p className="note" style={{ marginBottom: 12 }}>
              <b>Finish this {type.label.toLowerCase()}?</b> It gets saved to your history with the
              route, splits and an estimate of what it cost you.
            </p>
            <button className="btn btn-primary btn-wide takeover-cta" onClick={finish}>
              <Square size={18} /> Save it
            </button>
            <div className="row" style={{ gap: 10, marginTop: 10 }}>
              <button className="btn btn-quiet grow" onClick={() => setConfirmStop(false)}>
                Keep going
              </button>
              <button className="btn btn-danger" onClick={discard}>
                <X size={17} /> Discard
              </button>
            </div>
          </>
        ) : (
          <div className="row" style={{ gap: 10 }}>
            {stats.paused ? (
              <button
                className="btn btn-primary grow takeover-cta"
                onClick={() => { tapMedium(); resumeActivity(); }}
              >
                <Play size={19} /> Resume
              </button>
            ) : (
              <button
                className="btn btn-quiet grow takeover-cta"
                onClick={() => { tapMedium(); pauseActivity(); }}
              >
                <Pause size={19} /> Pause
              </button>
            )}
            <button className="btn btn-secondary takeover-cta" onClick={() => setConfirmStop(true)}>
              <Square size={19} /> Finish
            </button>
          </div>
        )}

        <p className="dim takeover-note" style={{ marginTop: 12 }}>
          You can lock the phone — recording continues, and the time and distance stay on the lock
          screen. Nothing is uploaded; the route never leaves this device.
        </p>
      </div>
    </div>
  );
}

/** Short unit from the formatter → the word to print under the big number. */
const UNIT_NAMES = { m: "metres", km: "kilometres", mi: "miles", ft: "feet" };

function paceLabel(stats, type, imperial) {
  if (!type.gps) return "—";
  if (type.id === "cycle") {
    const speed = imperial ? stats.speedKmh * 0.621371 : stats.speedKmh;
    return `${speed.toFixed(1)}`;
  }
  const pace = imperial && stats.paceSecPerKm ? stats.paceSecPerKm * 1.609344 : stats.paceSecPerKm;
  return formatPace(pace);
}
