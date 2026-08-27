import React, { useState } from "react";
import { Ruler, Camera, ChevronLeft, ChevronRight, Info, Images } from "lucide-react";
import {
  useStore, todayKey, addDays, parseKey, MEASUREMENTS, PHOTO_ANGLES,
  measurementsFor, setMeasurement, measurementSummary, measurementSeries,
  photosFor, setProgressPhoto, photoDays
} from "../lib/store.js";
import { Photo, PhotoPicker } from "./Photo.jsx";
import { lengthUnit, toDisplayLength, fromDisplayLength } from "../lib/units.js";

const r1 = n => Math.round(n * 10) / 10;
const shortDate = k => parseKey(k).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** A bare sparkline — enough to read a direction without pretending to precision. */
function Spark({ series }) {
  if (series.length < 2) return null;
  const W = 100, H = 26;
  const vals = series.map(s => s.v);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const d = series
    .map((s, i) => `${i ? "L" : "M"}${((i / (series.length - 1)) * W).toFixed(1)} ${(H - ((s.v - lo) / span) * H).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" style={{ overflow: "visible" }}>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Tape measurements and progress photos.
 *
 * Both live on the device and neither is required. The photos in particular are
 * the single most motivating record in a physique app and also the most personal,
 * so they never leave the phone and there is no sharing button anywhere near them.
 */
export default function BodyPanel() {
  useStore(s => s.measurements);
  useStore(s => s.photos);

  const [dateKey, setDateKey] = useState(todayKey());
  const [compare, setCompare] = useState(null);

  const values = measurementsFor(dateKey);
  const photos = photosFor(dateKey);
  const days = photoDays();
  const isToday = dateKey === todayKey();

  return (
    <div>
      {/* ── which day ── */}
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn btn-icon btn-quiet" onClick={() => setDateKey(addDays(dateKey, -1))} aria-label="Previous day">
          <ChevronLeft size={18} />
        </button>
        <div className="grow" style={{ textAlign: "center" }}>
          <div className="h4">{isToday ? "Today" : parseKey(dateKey).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</div>
        </div>
        <button
          className="btn btn-icon btn-quiet" onClick={() => setDateKey(addDays(dateKey, 1))}
          disabled={isToday} aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── tape ── */}
      <div className="sect-h">
        <h2 className="h4"><Ruler size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Measurements</h2>
        <span className="caps faint">{lengthUnit()}</span>
      </div>

      {MEASUREMENTS.map(m => {
        const summary = measurementSummary(m.key);
        const series = measurementSeries(m.key);
        return (
          <div className="card-sm" key={m.key} style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="h4" style={{ display: "block" }}>{m.label}</span>
                <span className="dim" style={{ display: "block", fontSize: 12, marginTop: 3 }}>
                  {summary
                    ? `${toDisplayLength(summary.latest)} ${lengthUnit()} on ${shortDate(summary.at)}${summary.change != null ? ` · ${summary.change >= 0 ? "+" : ""}${toDisplayLength(summary.change)} since ${shortDate(summary.since)}` : ""}`
                    : "Not measured yet"}
                </span>
              </span>
              {series.length > 1 && <Spark series={series} />}
              <input
                className="input num" type="number" inputMode="decimal" step="0.1" min="0"
                style={{ flex: "0 0 84px", padding: "10px 8px", textAlign: "center" }}
                value={values[m.key] == null ? "" : toDisplayLength(values[m.key])} placeholder="—"
                aria-label={`${m.label} in ${lengthUnit()}`}
                onChange={e => setMeasurement(dateKey, m.key, e.target.value === "" ? "" : fromDisplayLength(e.target.value))}
              />
            </div>
            <p className="dim" style={{ fontSize: 11.5, margin: "10px 0 0" }}>{m.hint}</p>
          </div>
        );
      })}

      <p className="note" style={{ marginTop: 14 }}>
        <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
        <b>Waist against arm is the honest signal on a bulk.</b> Both climbing means the surplus is
        about right. Only the waist climbing means it's too big — drop 200 kcal and watch for another
        fortnight before changing anything else.
      </p>

      {/* ── photos ── */}
      <div className="sect-h" style={{ marginTop: 30 }}>
        <h2 className="h4"><Camera size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Progress photos</h2>
        <span className="caps faint">{days.length} day{days.length === 1 ? "" : "s"}</span>
      </div>

      <div className="grid3">
        {PHOTO_ANGLES.map(a => (
          <div key={a.key}>
            <div className="caps faint" style={{ fontSize: 9.5, marginBottom: 8 }}>{a.label}</div>
            <PhotoPicker
              id={photos[a.key] || null}
              onChange={img => setProgressPhoto(dateKey, a.key, img)}
              size="progress"
              label="Add"
              replaceLabel="Change"
            />
          </div>
        ))}
      </div>

      <p className="note" style={{ marginTop: 16 }}>
        Same spot, same light, same time of day, relaxed — a photo taken in different conditions
        tells you nothing. Once a fortnight is plenty. These stay on this phone; there is no upload
        and no share button.
      </p>

      {days.length > 1 && (
        <>
          <div className="sect-h" style={{ marginTop: 30 }}>
            <h2 className="h4"><Images size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Side by side</h2>
          </div>
          <label className="field">
            <span className="lab">Compare {isToday ? "today" : shortDate(dateKey)} with</span>
            <select className="input" value={compare || ""} onChange={e => setCompare(e.target.value || null)}>
              <option value="">Pick a day…</option>
              {days.filter(k => k !== dateKey).map(k => (
                <option key={k} value={k}>{parseKey(k).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</option>
              ))}
            </select>
          </label>

          {compare && (
            <div className="grid2">
              {[dateKey, compare].map(k => (
                <div key={k}>
                  <div className="caps faint" style={{ fontSize: 9.5, marginBottom: 8 }}>
                    {k === todayKey() ? "Today" : shortDate(k)}
                  </div>
                  {PHOTO_ANGLES.map(a => {
                    const id = photosFor(k)[a.key];
                    if (!id) return null;
                    return (
                      <div className="photo-wide" key={a.key} style={{ marginBottom: 8 }}>
                        <Photo id={id} alt={`${a.label} on ${k}`} />
                      </div>
                    );
                  })}
                  {Object.keys(photosFor(k)).length === 0 && (
                    <div className="empty" style={{ padding: "20px 8px", fontSize: 12.5 }}>No photos</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
