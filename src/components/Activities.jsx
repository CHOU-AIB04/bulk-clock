import React, { useState } from "react";
import {
  Play, Footprints, Bike, Mountain, Waves, Dumbbell, Activity as ActivityIcon,
  MapPin, Flame, Timer, ChevronRight, AlertTriangle, Info
} from "lucide-react";
import {
  useStore, startActivity, activitySummary, deleteActivity, todayKey, parseKey
} from "../lib/store.js";
import { ACTIVITY_TYPES, typeOf, formatDuration, formatDistance, formatPace } from "../lib/activity.js";
import { isImperial } from "../lib/units.js";
import { currentPosition, isSupported } from "../lib/geo.js";
import { startLive } from "../lib/liveActivity.js";
import { tapMedium } from "../lib/haptics.js";
import ActivityDetail from "./ActivityDetail.jsx";
import RouteMap from "./RouteMap.jsx";
import SwipeRow from "./SwipeRow.jsx";

const ICONS = {
  run: Footprints, walk: Footprints, hike: Mountain,
  bike: Bike, row: Waves, other: ActivityIcon
};

const iconFor = type => ICONS[type.icon] || ActivityIcon;

const shortWhen = ts => new Date(ts).toLocaleDateString(undefined, {
  weekday: "short", day: "numeric", month: "short"
});

/**
 * Everything outside the gym: runs, rides, walks.
 *
 * This exists because a bulk is not only what you ate and what you lifted. Two
 * hours of walking a day changes the calorie target far more than an extra set
 * does, and a tracker that cannot see it is guessing.
 */
export default function Activities({ onStarted }) {
  const activities = useStore(s => s.activities);
  const live = useStore(s => s.live);
  const [picking, setPicking] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState("");

  const imperial = isImperial();
  const week = activitySummary(7);

  async function begin(type) {
    setError("");
    setStarting(type.id);

    // Ask for location before the timer starts, so the permission dialog does
    // not appear over a run that is already recording.
    if (type.gps) {
      if (!isSupported()) {
        setError("This device has no location services. You can still record time and effort.");
      } else {
        try {
          await currentPosition();
        } catch (e) {
          setError(e.message);
          setStarting("");
          return;
        }
      }
    }

    tapMedium();
    startActivity(type.id);
    startLive(`${type.label} · 0:00`, type.gps ? "Waiting for GPS" : "Recording");
    setStarting("");
    setPicking(false);
    onStarted?.();
  }

  return (
    <div>
      {!live && (
        <>
          {!picking ? (
            <button className="btn btn-primary btn-wide takeover-cta" onClick={() => setPicking(true)}>
              <Play size={19} /> Start an activity
            </button>
          ) : (
            <>
              <div className="sect-h" style={{ marginBottom: 12 }}>
                <h2 className="h4">What are you doing</h2>
                <button className="btn-ghost" onClick={() => setPicking(false)}>Cancel</button>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {ACTIVITY_TYPES.map(type => {
                  const Icon = iconFor(type);
                  return (
                    <button
                      key={type.id} className="pick"
                      disabled={!!starting}
                      onClick={() => begin(type)}
                    >
                      <span className="pick-ico"><Icon size={21} /></span>
                      <span className="grow">
                        <span className="pick-t">{type.label}</span>
                        <span className="pick-d">{type.blurb}</span>
                      </span>
                      {starting === type.id
                        ? <span className="caps neon">starting…</span>
                        : type.gps && <MapPin size={16} style={{ color: "var(--outline)" }} />}
                    </button>
                  );
                })}
              </div>

              {error && (
                <p className="note warn" style={{ marginTop: 14 }}>
                  <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                  {error}
                </p>
              )}

              <p className="note" style={{ marginTop: 14 }}>
                GPS activities need location permission and a view of the sky. Everything is recorded
                on this phone — there is no upload, no feed and no one else can see your routes.
              </p>
            </>
          )}
        </>
      )}

      {/* ── this week ── */}
      {week.count > 0 && (
        <div className="grid3" style={{ marginTop: 18 }}>
          <div className="card-sm" style={{ padding: 14 }}>
            <ActivityIcon size={16} style={{ color: "var(--accent-text)" }} />
            <div className="caps faint" style={{ fontSize: 9.5, marginTop: 8 }}>This week</div>
            <div className="stat-sm" style={{ marginTop: 5 }}>{week.count}</div>
          </div>
          <div className="card-sm" style={{ padding: 14 }}>
            <MapPin size={16} style={{ color: "var(--accent-text)" }} />
            <div className="caps faint" style={{ fontSize: 9.5, marginTop: 8 }}>Distance</div>
            <div className="stat-sm" style={{ marginTop: 5 }}>
              {formatDistance(week.distanceM, imperial).split(" ")[0]}
              <span className="dim" style={{ fontSize: 11, fontWeight: 400 }}>
                {" "}{imperial ? "mi" : "km"}
              </span>
            </div>
          </div>
          <div className="card-sm" style={{ padding: 14 }}>
            <Flame size={16} style={{ color: "var(--accent-text)" }} />
            <div className="caps faint" style={{ fontSize: 9.5, marginTop: 8 }}>Burned</div>
            <div className="stat-sm" style={{ marginTop: 5 }}>{week.calories}</div>
          </div>
        </div>
      )}

      {/* ── history ── */}
      <div className="sect-h" style={{ marginTop: 26 }}>
        <h2 className="h3">History</h2>
        <span className="caps faint">{activities.length}</span>
      </div>

      {activities.length === 0 && (
        <div className="empty">
          <span className="empty-ico"><Footprints size={24} /></span>
          Nothing recorded yet. A walk counts — it is the easiest activity to add without touching
          how well you recover from lifting.
        </div>
      )}

      {activities.slice(0, 25).map(a => {
        const type = typeOf(a.type);
        const Icon = iconFor(type);
        const pace = a.paceSecPerKm
          ? formatPace(imperial ? a.paceSecPerKm * 1.609344 : a.paceSecPerKm)
          : null;

        return (
          <SwipeRow key={a.id} label={type.label} onDelete={() => deleteActivity(a.id)}>
          <button className="list-row" onClick={() => setDetail(a)}>
            {type.gps && a.points?.length > 2 ? (
              <span style={{ flex: "0 0 62px", width: 62 }}>
                <RouteMap points={a.points} height={62} showTiles={false} padding={7} />
              </span>
            ) : (
              <span className="ico"><Icon size={19} /></span>
            )}
            <span className="grow">
              <span className="t">
                {type.gps ? formatDistance(a.distanceM, imperial) : formatDuration(a.movingMs)}
                <span className="dim" style={{ fontWeight: 400 }}> · {type.label}</span>
              </span>
              <span className="d">
                {shortWhen(a.startedAt)} · {formatDuration(a.movingMs)}
                {pace ? ` · ${pace}${imperial ? "/mi" : "/km"}` : ""}
              </span>
            </span>
            <span className="v">
              <span className="stat-sm">{a.calories}</span>
              <span className="d">kcal</span>
            </span>
            <ChevronRight size={17} style={{ color: "var(--outline)", flex: "0 0 auto" }} />
          </button>
          </SwipeRow>
        );
      })}

      {activities.length > 0 && (
        <p className="note" style={{ marginTop: 14 }}>
          <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          Activity calories are <b>not</b> added to your daily target by default. Measured
          maintenance already includes however much you normally move, so adding them back would
          count the same energy twice. There's a switch in settings if you disagree.
        </p>
      )}

      {detail && <ActivityDetail activity={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
