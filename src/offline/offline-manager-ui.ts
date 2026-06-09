/**
 * Shared UI helpers for rendering offline status and game download rows.
 * Used by both the offline screen and home screen game cards.
 */

import type { GameOfflineStatus, GameMeta } from "../shared/game-types.js";
import { getGameOfflineStatus, downloadGame, removeGame } from "./package-manager.js";

/** Format bytes to human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Get CSS class and label for a status badge. */
export function getStatusBadge(
  status: GameOfflineStatus,
): { class: string; label: string } {
  switch (status) {
    case "offline-ready":
      return { class: "status-badge--offline-ready", label: "Offline ready" };
    case "update-available":
      return { class: "status-badge--update-available", label: "Update available" };
    case "needs-update":
      return { class: "status-badge--update-available", label: "Needs update" };
    case "partial-download":
      return { class: "status-badge--not-downloaded", label: "Partial" };
    case "storage-removed":
      return { class: "status-badge--not-downloaded", label: "Storage removed" };
    case "online-only":
      return { class: "status-badge--not-downloaded", label: "Online only" };
    case "not-downloaded":
    default:
      return { class: "status-badge--not-downloaded", label: "Not downloaded" };
  }
}

/** Create a download/remove button for a game row. */
export function createActionButton(
  game: GameMeta,
  status: GameOfflineStatus,
  onStatusChange: () => void,
): HTMLElement {
  const btn = document.createElement("button");
  btn.className = "btn btn--small";

  switch (status) {
    case "not-downloaded":
    case "storage-removed":
    case "update-available":
    case "needs-update":
      btn.textContent = "Download";
      btn.addEventListener("click", async () => {
        btn.textContent = "Downloading...";
        btn.disabled = true;
        try {
          await downloadGame(game.id, (progress) => {
            if (progress.phase === "downloading" && progress.total > 0) {
              const pct = Math.round((progress.loaded / progress.total) * 100);
              btn.textContent = `Downloading ${pct}%`;
            }
            if (progress.phase === "error") {
              btn.textContent = "Failed — Retry";
            }
          });
          onStatusChange();
        } catch (err) {
          btn.textContent = "Failed — Retry";
          btn.disabled = false;
        }
      });
      break;

    case "offline-ready":
      btn.textContent = "Remove";
      btn.className = "btn btn--small btn--secondary";
      btn.addEventListener("click", async () => {
        btn.textContent = "Removing...";
        btn.disabled = true;
        try {
          await removeGame(game.id);
          onStatusChange();
        } catch {
          btn.textContent = "Error";
          btn.disabled = false;
        }
      });
      break;

    case "online-only":
      btn.textContent = "Online only";
      btn.disabled = true;
      break;

    default:
      btn.textContent = "Play";
      btn.addEventListener("click", () => {
        window.location.hash = `#/games/${game.id}`;
      });
  }

  return btn;
}

/** Render a live status badge into an element. */
export async function renderStatusBadge(
  el: HTMLElement,
  gameId: string,
): Promise<void> {
  const status = await getGameOfflineStatus(gameId);
  const badge = getStatusBadge(status);
  el.textContent = badge.label;
  el.className = `status-badge ${badge.class}`;
}

/** Escape HTML to prevent XSS. */
export function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
