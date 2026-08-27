import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, WifiOff } from "lucide-react";
import { simplify } from "../lib/activity.js";

const TILE = 256;
const MAX_ZOOM = 17;

/**
 * Web Mercator, the projection every slippy map on the internet uses. Returns
 * pixel coordinates at a given zoom, where the whole world is 256 × 2^zoom.
 */
function project(lat, lng, zoom) {
  const scale = TILE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const s = Math.min(0.9999, Math.max(-0.9999, Math.sin((lat * Math.PI) / 180)));
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/**
 * The route of an activity, drawn over map tiles.
 *
 * The line is drawn from the GPS track and always works — offline, on a plane,
 * in a basement. The map underneath comes from OpenStreetMap and is a bonus: if
 * the tiles do not load, the route is still perfectly readable on the app's own
 * background, which is the whole reason the line is drawn independently rather
 * than as part of a map widget.
 *
 * No map SDK, no API key, no tracking script — a handful of <img> tags and one
 * SVG path.
 */
export default function RouteMap({
  points,
  height = 220,
  showTiles = true,
  padding = 22,
  className = ""
}) {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const track = useMemo(() => simplify(points || [], 700), [points]);

  const layout = useMemo(() => {
    if (!track.length || width <= 0) return null;

    const lats = track.map(p => p.lat);
    const lngs = track.map(p => p.lng);
    const bounds = {
      minLat: Math.min(...lats), maxLat: Math.max(...lats),
      minLng: Math.min(...lngs), maxLng: Math.max(...lngs)
    };

    const usableW = Math.max(1, width - padding * 2);
    const usableH = Math.max(1, height - padding * 2);

    // Largest zoom at which the whole route still fits.
    let zoom = 1;
    for (let z = MAX_ZOOM; z >= 1; z--) {
      const a = project(bounds.maxLat, bounds.minLng, z);
      const b = project(bounds.minLat, bounds.maxLng, z);
      if (Math.abs(b.x - a.x) <= usableW && Math.abs(b.y - a.y) <= usableH) {
        zoom = z;
        break;
      }
    }

    const projected = track.map(p => project(p.lat, p.lng, zoom));
    const minX = Math.min(...projected.map(p => p.x));
    const maxX = Math.max(...projected.map(p => p.x));
    const minY = Math.min(...projected.map(p => p.y));
    const maxY = Math.max(...projected.map(p => p.y));

    // Centre the route in the box.
    const originX = minX - (width - (maxX - minX)) / 2;
    const originY = minY - (height - (maxY - minY)) / 2;

    const pixels = projected.map(p => ({ x: p.x - originX, y: p.y - originY }));
    const path = pixels.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

    // Which tiles cover the box.
    const tiles = [];
    const n = 2 ** zoom;
    const firstX = Math.floor(originX / TILE);
    const lastX = Math.floor((originX + width) / TILE);
    const firstY = Math.floor(originY / TILE);
    const lastY = Math.floor((originY + height) / TILE);

    for (let tx = firstX; tx <= lastX; tx++) {
      for (let ty = firstY; ty <= lastY; ty++) {
        if (ty < 0 || ty >= n) continue;
        const wrapped = ((tx % n) + n) % n;   // the world repeats east-west
        tiles.push({
          key: `${zoom}/${wrapped}/${ty}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`,
          left: tx * TILE - originX,
          top: ty * TILE - originY
        });
      }
    }

    return { zoom, path, pixels, tiles, start: pixels[0], end: pixels[pixels.length - 1] };
  }, [track, width, height, padding]);

  return (
    <div
      ref={boxRef}
      className={"routemap " + className}
      style={{ height }}
      role="img"
      aria-label={track.length ? `Route of ${track.length} recorded points` : "No route recorded"}
    >
      {showTiles && !tilesFailed && layout?.tiles.map(t => (
        <img
          key={t.key}
          src={t.url}
          alt=""
          className="routemap-tile"
          style={{ left: t.left, top: t.top }}
          loading="lazy"
          decoding="async"
          onError={() => setTilesFailed(true)}
        />
      ))}

      {/* Dims the light OSM tiles so a lime route reads on top of them. */}
      {showTiles && !tilesFailed && layout && <span className="routemap-scrim" />}

      {layout && (
        <svg className="routemap-svg" width={width} height={height} aria-hidden="true">
          <path d={layout.path} className="routemap-glow" />
          <path d={layout.path} className="routemap-line" />
          {layout.start && <circle cx={layout.start.x} cy={layout.start.y} r="6" className="routemap-start" />}
          {layout.end && <circle cx={layout.end.x} cy={layout.end.y} r="6" className="routemap-end" />}
        </svg>
      )}

      {!track.length && (
        <div className="routemap-empty">
          <MapPin size={20} />
          <span>No GPS fixes yet</span>
        </div>
      )}

      {showTiles && tilesFailed && track.length > 0 && (
        <span className="routemap-offline" title="Map tiles need a connection">
          <WifiOff size={12} /> route only
        </span>
      )}

      {showTiles && !tilesFailed && layout && (
        <span className="routemap-credit">© OpenStreetMap</span>
      )}
    </div>
  );
}
