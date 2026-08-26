import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { hydrate } from "./lib/store.js";
import "./styles.css";

/**
 * State lives in a file on device, so it has to be read before the first render.
 * Waiting here keeps every component synchronous — nothing downstream has to
 * cope with a half-loaded store.
 */
hydrate().finally(() => {
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
});
