/**
 * Klinefelter Game — Entry Point
 *
 * Boot sequence:
 *   1. Import the global stylesheet
 *   2. Mount the app shell
 *   3. Start the router
 *   4. Route handlers render screens on demand
 */

import "./ui/styles/main.css";
import { mountAppShell, clearContent, getContentElement, setTopBarStatus } from "./app/app-shell.js";
import { startRouter, on } from "./app/router.js";
import { registerSW, onSWStatusChange } from "./pwa/register-sw.js";
import {
  renderHomeScreen,
} from "./ui/screens/home-screen.js";
import {
  renderSettingsScreen,
} from "./ui/screens/settings-screen.js";
import {
  renderOfflineScreen,
} from "./ui/screens/offline-screen.js";
import {
  renderGameScreen,
  pauseCurrentGame,
} from "./ui/screens/game-screen.js";

// ---- Boot ----

const appContainer = document.getElementById("app");

if (!appContainer) {
  throw new Error("Fatal: #app element not found in DOM.");
}

// Mount the shared app shell (top bar + content area)
mountAppShell(appContainer);

// ---- Route handlers ----

// Home route: game launcher
on("/", () => {
  pauseCurrentGame();
  const content = getContentElement();
  clearContent();
  renderHomeScreen(content);
});

// Settings route
on("/settings", () => {
  pauseCurrentGame();
  const content = getContentElement();
  clearContent();
  renderSettingsScreen(content);
});

// Offline manager route
on("/offline", () => {
  pauseCurrentGame();
  const content = getContentElement();
  clearContent();
  renderOfflineScreen(content);
});

// Game routes: /games/:gameId
on("/games/:gameId", (params) => {
  const content = getContentElement();
  clearContent();
  renderGameScreen(content, params.gameId);
});

// ---- PWA ----

// Listen for online/offline status
onSWStatusChange((status) => {
  if (status.offline) {
    setTopBarStatus("Offline");
  } else if (status.updated) {
    setTopBarStatus("Update ready — reload to apply");
  } else {
    setTopBarStatus("");
  }
});

// Register service worker for offline support
registerSW();

// ---- Start ----

// Begin listening for hash changes and fire the initial route
startRouter();
