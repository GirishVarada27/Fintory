import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./i18n";
import App from "./App";
import { ViewingAsProvider } from "./lib/ViewingAsContext";
import { ThemeProvider } from "./lib/ThemeContext";
import { syncOfflineQueue } from "./api/client";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline caching is a progressive enhancement — a failed registration
      // (e.g. unsupported browser) shouldn't block the app from working.
    });
  });
}

window.addEventListener("online", () => {
  syncOfflineQueue();
});
if (navigator.onLine) {
  syncOfflineQueue();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ViewingAsProvider>
          <App />
        </ViewingAsProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
