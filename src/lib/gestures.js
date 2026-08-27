/**
 * The gestures a phone is expected to have.
 *
 * Tapping a small X in a corner is a desktop idea. On a phone a panel that slid
 * up from the bottom should be pushed back down, and the hardware back button
 * should close what is open rather than quitting the app.
 *
 * This is deliberately a global layer rather than a prop on each sheet. Every
 * sheet in the app is already the same two elements — a `.sheet-bg` backdrop
 * whose click handler closes it, and a `.sheet` panel — so one listener gives
 * the behaviour to all fifteen of them, and to any written later, with no
 * component changes and nothing to forget.
 */

/** How far down you must drag before releasing dismisses rather than springs back. */
const DISMISS_PX = 110;

/** Or a flick: pixels per millisecond downward. */
const DISMISS_VELOCITY = 0.55;

/** Below this the gesture is a tap or a scroll, not a drag. */
const START_SLOP = 8;

/** Close a sheet the way a backdrop tap does, so each one keeps its own logic. */
function closeSheet(backdrop) {
  backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

/** The topmost open sheet, since they can stack. */
function topSheet() {
  const all = document.querySelectorAll(".sheet-bg");
  return all.length ? all[all.length - 1] : null;
}

/* ── drag a sheet down to dismiss ────────────────────────── */

export function installSheetDrag() {
  let panel = null;
  let backdrop = null;
  let startY = 0;
  let startX = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let dragging = false;
  let decided = false;

  function reset(animate) {
    if (panel) {
      if (animate) {
        panel.style.transition = "transform 0.28s cubic-bezier(.32,.72,0,1)";
        panel.style.transform = "";
        const el = panel;
        setTimeout(() => { el.style.transition = ""; }, 300);
      } else {
        panel.style.transition = "";
        panel.style.transform = "";
      }
    }
    if (backdrop) backdrop.style.opacity = "";
    panel = null;
    backdrop = null;
    dragging = false;
    decided = false;
  }

  function onStart(e) {
    if (e.touches.length !== 1) return;
    const target = e.target;
    if (!(target instanceof Element)) return;

    const found = target.closest(".sheet");
    if (!found) return;

    // Never hijack a real control or a text field.
    if (target.closest("input, textarea, select, button, a")) {
      // The grabber is a div, so buttons genuinely mean "not a drag" here —
      // except that the whole header is often buttons, which is why the
      // scrollTop check below is what actually gates the gesture.
      if (!target.closest(".grabber")) return;
    }

    panel = found;
    backdrop = found.closest(".sheet-bg");
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    lastY = startY;
    lastT = e.timeStamp;
    velocity = 0;
    dragging = false;
    decided = false;
  }

  function onMove(e) {
    if (!panel || e.touches.length !== 1) return;

    const y = e.touches[0].clientY;
    const x = e.touches[0].clientX;
    const dy = y - startY;
    const dx = x - startX;

    if (!decided) {
      if (Math.abs(dy) < START_SLOP && Math.abs(dx) < START_SLOP) return;

      // Sideways means the user is swiping something inside the sheet.
      // Upwards, or anywhere in a sheet already scrolled down, means scrolling.
      const scrolled = panel.scrollTop > 1;
      const grabbing = e.target instanceof Element && !!e.target.closest(".grabber");
      decided = true;

      if (Math.abs(dx) > Math.abs(dy) || (dy < 0) || (scrolled && !grabbing)) {
        panel = null;
        backdrop = null;
        return;
      }
      dragging = true;
    }

    if (!dragging || dy <= 0) return;

    const dt = Math.max(1, e.timeStamp - lastT);
    velocity = (y - lastY) / dt;
    lastY = y;
    lastT = e.timeStamp;

    // Resistance past the halfway point, so a long drag still feels attached.
    const eased = dy > 220 ? 220 + (dy - 220) * 0.35 : dy;

    panel.style.transition = "";
    panel.style.transform = `translateY(${eased}px)`;
    if (backdrop) {
      backdrop.style.opacity = String(Math.max(0.25, 1 - eased / 460));
    }

    // Stop the page behind scrolling with the drag.
    if (e.cancelable) e.preventDefault();
  }

  function onEnd() {
    if (!panel || !dragging) {
      reset(false);
      return;
    }

    const dy = lastY - startY;
    const shouldClose = dy > DISMISS_PX || velocity > DISMISS_VELOCITY;

    if (shouldClose && backdrop) {
      const target = backdrop;
      const sheet = panel;
      sheet.style.transition = "transform 0.22s cubic-bezier(.32,.72,0,1)";
      sheet.style.transform = "translateY(100%)";
      target.style.transition = "opacity 0.22s linear";
      target.style.opacity = "0";
      panel = null;
      backdrop = null;
      dragging = false;
      decided = false;
      // Let the animation play before the component unmounts.
      setTimeout(() => closeSheet(target), 180);
      return;
    }

    reset(true);
  }

  // `passive: false` on move only — the others never call preventDefault.
  document.addEventListener("touchstart", onStart, { passive: true });
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onEnd, { passive: true });
  document.addEventListener("touchcancel", onEnd, { passive: true });

  return () => {
    document.removeEventListener("touchstart", onStart);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
    document.removeEventListener("touchcancel", onEnd);
  };
}

/* ── the hardware back button ────────────────────────────── */

const backHandlers = [];

/**
 * Register something for back to close. Later registrations win, so a sheet
 * opened on top of a screen is what closes first.
 */
export function pushBackHandler(fn) {
  backHandlers.push(fn);
  return () => {
    const i = backHandlers.indexOf(fn);
    if (i >= 0) backHandlers.splice(i, 1);
  };
}

/**
 * Wire Android's back button.
 *
 * Order matters: sheets first because they are literally on top, then whatever
 * the app has registered, and only then leaving. The double-tap to exit is the
 * Android convention and stops a stray back press throwing away a session.
 */
export async function installBackButton({ onExitAttempt } = {}) {
  let exitArmed = false;
  let armTimer = null;

  const handle = () => {
    const sheet = topSheet();
    if (sheet) {
      closeSheet(sheet);
      return;
    }

    for (let i = backHandlers.length - 1; i >= 0; i--) {
      if (backHandlers[i]() === true) return;      // handled
    }

    if (exitArmed) {
      exitArmed = false;
      clearTimeout(armTimer);
      exitApp();
      return;
    }

    exitArmed = true;
    onExitAttempt?.();
    armTimer = setTimeout(() => { exitArmed = false; }, 2200);
  };

  let exitApp = () => {};

  try {
    const { App } = await import("@capacitor/app");
    exitApp = () => App.exitApp();
    const listener = await App.addListener("backButton", handle);
    return () => listener.remove();
  } catch {
    // Browser: the closest equivalent is the history back button.
    const onPop = () => { handle(); window.history.pushState(null, ""); };
    window.history.pushState(null, "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }
}
