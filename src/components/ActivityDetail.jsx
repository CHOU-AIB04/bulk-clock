import React from "react";
import { X, Trash2, Timer, Gauge, Mountain, Flame, MapPin, Info } from "lucide-react";
import { useStore, deleteActivity } from "../lib/store.js";
import { typeOf, formatDuration, formatDistance, formatPace } from "../lib/activity.js";
import { isImperial } from "../lib/units.js";
import RouteMap from "./RouteMap.jsx";

const when = ts => new Date(ts).toLocaleDateString(undefined, {
  weekday: "long", day: "numeric", month: "long",
  hour: "2-digit", minute: "2-digit"
});

/** One saved activity: the route, the numbers, and every split. */
export default function ActivityDetail({ activity, onClose }) {
  useStore(s => s.activities);
  const type = typeOf(activity.type);
  const imperial = isImperial();

  const paceUnit = imperial ? "/mi" : "/km";
  const pace = activity.paceSecPerKm
    ? formatPace(imperial ? activity.paceSecPerKm * 1.609344 : activity.paceSecPerKm)
    : "—";
  const speed = activity.movingMs > 0
    ? ((activity.distanceM / 1000) / (activity.movingMs / 3600000)) * (imperial ? 0.621371 : 1)
    : 0;

  const best = activity.splits?.filter(s => !s.partial)
    .reduce((min, s) => (!min || s.paceSecPerKm < min.paceSecPerKm ? s : min), null);

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />

        <div className="sheet-h">
          <span className="grow" style={{ minWidth: 0 }}>
            <h3 className="h3" style={{ margin: 0 }}>{type.label}</h3>
            <span className="dim" style={{ fontSize: 12.5 }}>{when(activity.startedAt)}</span>
          </span>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        {type.gps && activity.points?.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <RouteMap points={activity.points} height={230} />
          </div>
        )}

        {type.gps && (
          <div className="hero" style={{ marginBottom: 14 }}>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div className="caps">Distance</div>
              <div className="stat-xl" style={{ marginTop: 10 }}>
                {formatDistance(activity.distanceM, imperial)}
              </div>
            </div>
          </div>
        )}

        <div className="grid3">
          <div className="card-sm" style={{ padding: 14 }}>
            <Timer size={16} style={{ color: "var(--accent-text)" }} />
            <div className="caps faint" style={{ fontSize: 9.5, marginTop: 8 }}>Moving</div>
            <div className="stat-sm" style={{ marginTop: 5 }}>{formatDuration(activity.movingMs)}</div>
          </div>
          <div className="card-sm" style={{ padding: 14 }}>
            <Gauge size={16} style={{ color: "var(--accent-text)" }} />
            <div className="caps faint" style={{ fontSize: 9.5, marginTop: 8 }}>
              {type.id === "cycle" ? "Speed" : "Pace"}
            </div>
            <div className="stat-sm" style={{ marginTop: 5 }}>
              {type.gps
                ? type.id === "cycle" ? `${speed.toFixed(1)}` : pace
                : "—"}
              <span className="dim" style={{ fontSize: 11, fontWeight: 400 }}>
                {type.gps ? (type.id === "cycle" ? (imperial ? " mph" : " km/h") : paceUnit) : ""}
              </span>
            </div>
          </div>
          <div className="card-sm" style={{ padding: 14 }}>
            <Flame size={16} style={{ color: "var(--accent-text)" }} />
            <div className="caps faint" style={{ fontSize: 9.5, marginTop: 8 }}>Burned</div>
            <div className="stat-sm" style={{ marginTop: 5 }}>{activity.calories}</div>
          </div>
        </div>

        {type.gps && activity.elevationM > 0 && (
          <div className="card-sm" style={{ marginTop: 10 }}>
            <div className="row">
              <Mountain size={17} style={{ color: "var(--accent-text)" }} />
              <span className="grow" style={{ fontSize: 14.5 }}>Elevation gained</span>
              <span className="stat-sm">{activity.elevationM} m</span>
            </div>
          </div>
        )}

        {activity.splits?.length > 0 && (
          <>
            <div className="sect-h" style={{ marginTop: 24 }}>
              <h2 className="h4">Splits</h2>
              <span className="caps faint">per {imperial ? "mile" : "km"}</span>
            </div>

            {activity.splits.map(split => {
              const p = imperial ? split.paceSecPerKm * 1.609344 : split.paceSecPerKm;
              const isBest = best && split.index === best.index;
              // Bars are relative to the slowest split, so the shape of the run
              // is visible rather than every bar being nearly full.
              const slowest = Math.max(...activity.splits.filter(s => !s.partial).map(s => s.paceSecPerKm), 1);
              const width = Math.max(12, (1 - (split.paceSecPerKm / slowest) * 0.55) * 100);

              return (
                <div className="card-sm" key={split.index} style={{ marginBottom: 8, padding: 12 }}>
                  <div className="row" style={{ alignItems: "baseline" }}>
                    <span className="n-badge">{split.index}</span>
                    <span className="grow" />
                    {isBest && <span className="badge" style={{ marginRight: 8 }}>fastest</span>}
                    <span className="stat-sm tnum">{formatPace(p)}</span>
                    <span className="dim" style={{ fontSize: 11 }}>{paceUnit}</span>
                  </div>
                  <div className="bar" style={{ marginTop: 9, height: 6 }}>
                    <i style={{ width: `${width}%`, background: isBest ? "var(--accent-bright)" : undefined }} />
                  </div>
                  {split.partial && (
                    <div className="dim" style={{ fontSize: 11, marginTop: 7 }}>
                      Part split — {formatDistance(split.distanceM, imperial)}, not comparable to a full one
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {activity.note && (
          <p className="note" style={{ marginTop: 16 }}>{activity.note}</p>
        )}

        <p className="note" style={{ marginTop: 16 }}>
          <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          Calories are estimated from METs and your bodyweight — the right order of magnitude, not a
          measurement. Elevation comes from GPS altitude, which drifts; it is smoothed before being
          counted but is still the least trustworthy number here.
        </p>

        <button
          className="btn btn-danger btn-wide" style={{ marginTop: 16 }}
          onClick={() => { deleteActivity(activity.id); onClose(); }}
        >
          <Trash2 size={17} /> Delete this activity
        </button>
      </div>
    </div>
  );
}
