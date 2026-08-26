import React from "react";

/**
 * Progress ring with rounded caps. Colours come from CSS variables so the ring
 * follows the theme (and any future accent change) without touching this file.
 * The gradient id is derived from `id` so several rings can coexist on one screen.
 */
export default function Ring({ value, max, size = 104, stroke = 12, id = "r", children, tone, track = "var(--surface-high)" }) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gid = `grad-${id}`;

  const from = tone === "warn" ? "var(--warn)" : tone === "danger" ? "var(--danger)" : "var(--accent-deep)";
  const to = tone === "warn" ? "var(--warn)" : tone === "danger" ? "var(--danger)" : "var(--accent-bright)";

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gid})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.32,.72,0,1)" }}
        />
      </svg>
      <div className="ring-c">{children}</div>
    </div>
  );
}
