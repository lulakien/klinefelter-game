/**
 * Shared app shell — a thin wrapper that provides consistent chrome
 * (top bar, content area, error fallback) across all screens.
 *
 * The shell does NOT own routing; it just provides the DOM container.
 * Screens render themselves into the shell's content slot.
 */

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
