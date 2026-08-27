import React, { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { warn } from "../lib/haptics.js";

/** Past this the row is gone on release; before it, it springs back. */
const COMMIT_PX = 96;

/**
 * A list row you can swipe away.
 *
 * Deleting on a phone should be a swipe, not a hunt for a small icon. The row
 * follows your finger, a red panel appears behind it, and past a threshold it
 * commits — with a buzz at the moment it arms, so you know before you let go
 * rather than after.
 *
 * The delete button stays in the DOM underneath. Swiping is the faster path, not
 * the only one, which matters for anyone using a screen reader or a keyboard.
 */
export default function SwipeRow({ children, onDelete, label = "item", disabled = false }) {
  const [offset, setOffset] = useState(0);
  const [gone, setGone] = useState(false);
  const start = useRef(null);
  const armed = useRef(false);
  const dragging = useRef(false);

  function onStart(e) {
    if (disabled || e.touches.length !== 1) return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragging.current = false;
    armed.current = false;
  }

  function onMove(e) {
    if (!start.current || e.touches.length !== 1) return;

    const dx = e.touches[0].clientX - start.current.x;
    const dy = e.touches[0].clientY - start.current.y;

    if (!dragging.current) {
      // Vertical wins: the list has to stay scrollable.
      if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 10) {
        if (Math.abs(dy) > 10) start.current = null;
        return;
      }
      dragging.current = true;
    }

    // Left only. Rightwards would fight the system's back gesture.
    const next = Math.min(0, dx);
    setOffset(next);

    if (!armed.current && next < -COMMIT_PX) {
      armed.current = true;
      warn();
    } else if (armed.current && next > -COMMIT_PX) {
      armed.current = false;
    }

    if (e.cancelable) e.preventDefault();
  }

  function onEnd() {
    if (!start.current || !dragging.current) {
      start.current = null;
      setOffset(0);
      return;
    }
    start.current = null;
    dragging.current = false;

    if (armed.current) {
      setGone(true);
      // Let it slide out before the list re-renders without it.
      setTimeout(() => onDelete(), 190);
      return;
    }
    setOffset(0);
  }

  const revealed = Math.min(1, Math.abs(offset) / COMMIT_PX);

  return (
    <div className={"swipe-row" + (gone ? " gone" : "")}>
      {/* Hidden entirely at rest. At 0.35 opacity it showed through every row
          that was not being swiped, which made the whole list look like an
          error state. */}
      <div
        className="swipe-behind"
        style={{ opacity: offset === 0 ? 0 : 0.5 + revealed * 0.5 }}
        aria-hidden="true"
      >
        <Trash2 size={19} />
        <span>{Math.abs(offset) > COMMIT_PX ? "Release to delete" : "Keep swiping"}</span>
      </div>

      <div
        className="swipe-front"
        style={{
          transform: gone ? "translateX(-110%)" : `translateX(${offset}px)`,
          transition: offset === 0 || gone ? "transform 0.22s cubic-bezier(.32,.72,0,1)" : "none"
        }}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        onTouchCancel={onEnd}
      >
        {children}
      </div>
    </div>
  );
}
