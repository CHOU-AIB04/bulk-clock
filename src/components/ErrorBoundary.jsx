import React from "react";

/**
 * A render failure should cost you the screen, not the session.
 *
 * There is no crash-reporting service behind this app, so the error is kept
 * locally and can be copied out — that is the only way a bug on someone else's
 * phone ever reaches you.
 */
const LOG_KEY = "bulkclock.errors.v1";

function record(error, info) {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    log.unshift({
      at: new Date().toISOString(),
      message: String(error?.message || error),
      stack: String(error?.stack || "").slice(0, 2000),
      component: String(info?.componentStack || "").slice(0, 1200)
    });
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 20)));
  } catch {
    /* if even this fails, the screen below is still shown */
  }
}

export function readErrorLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearErrorLog() {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    record(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="shell">
        <div className="scroll">
          <div className="page" style={{ paddingTop: "calc(48px + env(safe-area-inset-top))" }}>
            <div className="badge danger" style={{ marginBottom: 20 }}>Something broke</div>
            <h1 className="h2">This screen failed to draw.</h1>
            <p className="dim" style={{ marginTop: 12 }}>
              Your data is safe — it's stored separately from what's on screen. Reopening usually
              clears it. If it keeps happening, copy the details below and send them on.
            </p>

            <div className="card" style={{ marginTop: 20 }}>
              <div className="caps faint" style={{ marginBottom: 10 }}>What went wrong</div>
              <p style={{ fontFamily: "monospace", fontSize: 12.5, margin: 0, wordBreak: "break-word" }}>
                {String(this.state.error?.message || this.state.error)}
              </p>
            </div>

            <button
              className="btn btn-primary btn-wide" style={{ marginTop: 20 }}
              onClick={() => window.location.reload()}
            >
              Reload the app
            </button>
            <button
              className="btn btn-ghost btn-wide" style={{ marginTop: 8 }}
              onClick={() => {
                const text = JSON.stringify(readErrorLog(), null, 2);
                navigator.clipboard?.writeText(text).catch(() => {});
              }}
            >
              Copy the error details
            </button>
          </div>
        </div>
      </div>
    );
  }
}
