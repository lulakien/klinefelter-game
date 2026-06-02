/**
 * Shared app shell — a thin wrapper that provides consistent chrome
 * (top bar, content area, error fallback) across all screens.
 *
 * The shell does NOT own routing; it just provides the DOM container.
 * Screens render themselves into the shell's content slot.
 */

import { triggerSWUpdate } from "../pwa/register-sw.js";

const APP_SHELL_ID = "app-shell";

let shellEl: HTMLElement | null = null;
let topBarEl: HTMLElement | null = null;
let contentEl: HTMLElement | null = null;

/** Create the app shell DOM once on startup. */
export function mountAppShell(container: HTMLElement): void {
  shellEl = document.createElement("div");
  shellEl.id = APP_SHELL_ID;

  // Top bar
  topBarEl = document.createElement("header");
  topBarEl.className = "app-topbar";

  const title = document.createElement("span");
  title.className = "app-topbar__title";
  title.textContent = "Klinefelter Game";

  const statusBadge = document.createElement("span");
  statusBadge.className = "app-topbar__status";
  statusBadge.id = "topbar-status";
  statusBadge.textContent = "";

  topBarEl.appendChild(title);
  topBarEl.appendChild(statusBadge);

  // Content area
  contentEl = document.createElement("main");
  contentEl.className = "app-content";
  contentEl.id = "app-content";

  shellEl.appendChild(topBarEl);
  shellEl.appendChild(contentEl);

  container.appendChild(shellEl);
}

/** Get the content element where screens render. */
export function getContentElement(): HTMLElement {
  if (!contentEl) {
    throw new Error("App shell not mounted. Call mountAppShell() first.");
  }
  return contentEl;
}

/** Set the top bar subtitle / status text. */
export function setTopBarStatus(text: string): void {
  const el = document.getElementById("topbar-status");
  if (el) el.textContent = text;
}

/** Clear all content and unmount current screen. */
export function clearContent(): void {
  if (contentEl) {
    contentEl.innerHTML = "";
  }
}

/** Show a full-screen error fallback inside the content area. */
export function showErrorFallback(message: string): void {
  clearContent();
  if (!contentEl) return;

  const wrap = document.createElement("div");
  wrap.className = "error-fallback";

  const icon = document.createElement("div");
  icon.className = "error-fallback__icon";
  icon.textContent = "!";

  const msg = document.createElement("p");
  msg.textContent = message;

  const btn = document.createElement("button");
  btn.className = "btn btn--primary";
  btn.textContent = "Go Home";
  btn.addEventListener("click", () => {
    window.location.hash = "#/";
  });

  wrap.appendChild(icon);
  wrap.appendChild(msg);
  wrap.appendChild(btn);
  contentEl.appendChild(wrap);
}

let activeScreenCleanup: (() => void) | null = null;

/** Register a cleanup function for the active screen. */
export function setScreenCleanup(cleanup: (() => void) | null): void {
  triggerScreenCleanup();
  activeScreenCleanup = cleanup;
}

/** Run the cleanup function for the active screen. */
export function triggerScreenCleanup(): void {
  if (activeScreenCleanup) {
    try {
      activeScreenCleanup();
    } catch (err) {
      console.error("Error during active screen cleanup:", err);
    }
    activeScreenCleanup = null;
  }
}

/** Show a floating PWA update notification banner. */
export function showUpdateBanner(): void {
  if (document.getElementById("pwa-update-banner")) return;

  const banner = document.createElement("div");
  banner.id = "pwa-update-banner";
  banner.className = "pwa-update-banner";
  banner.innerHTML = `
    <span>A new update is available with features and fixes!</span>
    <button class="btn btn--small btn--primary" id="btn-pwa-update">Update Now</button>
  `;

  document.body.appendChild(banner);

  const btn = banner.querySelector("#btn-pwa-update");
  if (btn) {
    btn.addEventListener("click", () => {
      btn.textContent = "Updating...";
      (btn as HTMLButtonElement).disabled = true;
      triggerSWUpdate();
    });
  }
}
