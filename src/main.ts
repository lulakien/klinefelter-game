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
import { mountAppShell, clearContent, getContentElement, setTopBarStatus, triggerScreenCleanup, showUpdateBanner } from "./app/app-shell.js";
import { startRouter, on } from "./app/router.js";
import { registerSW, onSWStatusChange } from "./pwa/register-sw.js";
import { renderHomeScreen } from "./ui/screens/home-screen.js";
import { renderSettingsScreen } from "./ui/screens/settings-screen.js";
import { renderOfflineScreen } from "./ui/screens/offline-screen.js";
import { renderScoresScreen } from "./ui/screens/scores-screen.js";
import { renderGameScreen, destroyCurrentGame } from "./ui/screens/game-screen.js";
import { playSfx } from "./app/audio-manager.js";

// ---- Boot ----

const appContainer = document.getElementById("app");

if (!appContainer) {
  throw new Error("Fatal: #app element not found in DOM.");
}

mountAppShell(appContainer);

// ---- Route handlers ----
// IMPORTANT: destroyCurrentGame() must be called BEFORE clearContent()
// so the running game is stopped and its resources freed before the DOM
// is modified. The game route handler also calls it, but doing it here
// ensures the game is dead before any screen transition.

on("/", () => {
  destroyCurrentGame();
  triggerScreenCleanup();
  const content = getContentElement();
  clearContent();
  renderHomeScreen(content);
});

on("/settings", () => {
  destroyCurrentGame();
  triggerScreenCleanup();
  const content = getContentElement();
  clearContent();
  renderSettingsScreen(content);
});

on("/offline", () => {
  destroyCurrentGame();
  triggerScreenCleanup();
  const content = getContentElement();
  clearContent();
  renderOfflineScreen(content);
});

on("/scores", () => {
  destroyCurrentGame();
  triggerScreenCleanup();
  const content = getContentElement();
  clearContent();
  renderScoresScreen(content);
});

on("/games/:gameId", (params) => {
  destroyCurrentGame();
  triggerScreenCleanup();
  const content = getContentElement();
  clearContent();
  renderGameScreen(content, params.gameId);
});

// ---- PWA ----

onSWStatusChange((status) => {
  if (status.offline) {
    setTopBarStatus("Offline");
  } else {
    setTopBarStatus("");
  }

  // Display the update banner instead of hijacking control
  if (status.updated) {
    showUpdateBanner();
  }
});

registerSW();

// ---- Global Auditory Feedback ----

document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const clickTarget = target.closest("button, a, .btn, .toggle-btn, .game-card");
  if (clickTarget && !clickTarget.classList.contains("game-card--disabled")) {
    playSfx("click");
  }
});

// ---- Start ----

startRouter();
