import { getAllGames, getGameSize } from "../../app/game-registry.js";
import { getSWStatus, onSWStatusChange } from "../../pwa/register-sw.js";
import { getQualityMode, getSettings } from "../../settings/settings-store.js";
import {
  getGameOfflineStatus,
  downloadAllSingleplayer,
  getStorageEstimate,
  requestPersistence,
} from "../../offline/package-manager.js";
import {
  formatBytes,
  getStatusBadge,
  createActionButton,
} from "../../offline/offline-manager-ui.js";
import { setScreenCleanup } from "../../app/app-shell.js";
import type { GameMeta } from "../../shared/game-types.js";

let unsubSW: (() => void) | null = null;

export function renderOfflineScreen(container: HTMLElement): void {
  if (unsubSW) { unsubSW(); unsubSW = null; }

  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "offline-screen";

  wrapper.innerHTML = `
    <h1 class="screen-title">Offline Manager</h1>

    <section class="offline-section">
      <h2>Connection & App Shell</h2>
      <div class="offline-row">
        <span>Connection State:</span>
        <span class="status-badge" id="badge-connection">...</span>
      </div>
      <div class="offline-row">
        <span>Service Worker:</span>
        <span class="status-badge" id="badge-sw">...</span>
      </div>
    </section>

    <section class="offline-section">
      <h2>Storage Usage</h2>
      <div id="storage-container">
        <p id="storage-estimate">Estimating...</p>
      </div>
      <button class="btn btn--small btn--secondary" id="btn-persist" style="display:none; margin-top: 12px;">
        Request Persistent Storage
      </button>
    </section>

    <section class="offline-section">
      <h2>Installed Games</h2>
      <div id="offline-game-list"></div>
    </section>

    <div class="offline-actions">
      <button class="btn btn--primary" id="btn-download-all">Download All Games</button>
      <a class="btn btn--secondary" href="#/">Back to Home</a>
    </div>
  `;

  container.appendChild(wrapper);

  // Live status updates
  unsubSW = onSWStatusChange(() => updateConnectionStatus());

  // Register screen cleanup to prevent leaks
  setScreenCleanup(() => {
    if (unsubSW) {
      unsubSW();
      unsubSW = null;
    }
  });

  updateConnectionStatus();
  updateStorageInfo();
  renderGameList();
}

function updateConnectionStatus(): void {
  const swStatus = getSWStatus();

  const connBadge = document.getElementById("badge-connection");
  if (connBadge) {
    connBadge.textContent = swStatus.offline ? "Offline" : "Online";
    connBadge.className = swStatus.offline
      ? "status-badge status-badge--not-downloaded"
      : "status-badge status-badge--offline-ready";
  }

  const swBadge = document.getElementById("badge-sw");
  if (swBadge) {
    if (!swStatus.registered) {
      swBadge.textContent = "Not installed";
      swBadge.className = "status-badge status-badge--not-downloaded";
    } else if (swStatus.updated) {
      swBadge.textContent = "Update available";
      swBadge.className = "status-badge status-badge--update-available";
    } else {
      swBadge.textContent = "Active ✓";
      swBadge.className = "status-badge status-badge--offline-ready";
    }
  }

  // Disable download buttons when offline
  const downloadAllBtn = document.getElementById("btn-download-all") as HTMLButtonElement | null;
  if (downloadAllBtn) {
    if (swStatus.offline) {
      downloadAllBtn.disabled = true;
      downloadAllBtn.textContent = "Offline — Cannot Download";
    } else {
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = "Download All Games";
    }
  }
}

async function updateStorageInfo(): Promise<void> {
  const container = document.getElementById("storage-container");
  if (!container) return;

  const est = await getStorageEstimate();
  if (est && est.quota > 0) {
    const percentage = (est.usage / est.quota) * 100;
    const pctString = percentage < 0.1 && est.usage > 0 ? "< 0.1%" : `${percentage.toFixed(1)}%`;
    
    container.innerHTML = `
      <div class="storage-text">Using <strong>${formatBytes(est.usage)}</strong> of <strong>${formatBytes(est.quota)}</strong> (${pctString})</div>
      <div class="storage-bar">
        <div class="storage-bar__fill" style="width: ${percentage}%"></div>
      </div>
    `;
  } else {
    container.innerHTML = `<p id="storage-estimate">Storage API not available in this browser.</p>`;
  }

  // Persistent storage button
  const btn = document.getElementById("btn-persist") as HTMLButtonElement | null;
  if (btn && "storage" in navigator && "persist" in navigator.storage) {
    try {
      const persisted = await navigator.storage.persisted();
      if (!persisted) {
        btn.style.display = "";
        btn.addEventListener("click", async () => {
          const granted = await requestPersistence();
          if (granted) {
            btn.textContent = "✓ Persistent storage granted";
            btn.disabled = true;
          } else {
            btn.textContent = "Not granted — try again";
          }
        });
      }
    } catch {
      btn.style.display = "none";
    }
  }
}

async function renderGameList(): Promise<void> {
  const list = document.getElementById("offline-game-list");
  if (!list) return;

  const games = getAllGames();
  list.innerHTML = "";

  // Check if all games are not downloaded
  const allStatuses = await Promise.all(
    games.map(async (game) => {
      try {
        return await getGameOfflineStatus(game.id);
      } catch {
        return "not-downloaded";
      }
    })
  );

  const allNotDownloaded = allStatuses.every((status) => status === "not-downloaded");

  if (allNotDownloaded) {
    list.innerHTML = `
      <div class="empty-state">
        <p class="empty-state__icon">📦</p>
        <h3>No Games Downloaded</h3>
        <p>Download games from the home screen to play offline.</p>
        <a href="#/" class="btn btn--primary">Browse Games</a>
      </div>
    `;
    return;
  }

  for (const game of games) {
    const row = await createGameRow(game);
    list.appendChild(row);
  }

  // Download all button
  const downloadAllBtn = document.getElementById("btn-download-all") as HTMLButtonElement | null;
  if (downloadAllBtn) {
    downloadAllBtn.onclick = async () => {
      downloadAllBtn.disabled = true;
      downloadAllBtn.textContent = "Downloading...";
      const { succeeded, failed } = await downloadAllSingleplayer();
      downloadAllBtn.textContent = `Done: ${succeeded.length} OK, ${failed.length} failed`;
      setTimeout(() => {
        renderGameList();
        updateStorageInfo();
      }, 1500);
    };
  }
}

async function createGameRow(game: GameMeta): Promise<HTMLElement> {
  const row = document.createElement("div");
  row.className = "offline-game-row";
  row.id = `offline-row-${game.id}`;

  const settings = getSettings();
  const qualityMode = getQualityMode();
  const size = getGameSize(game, qualityMode);
  const status = await getGameOfflineStatus(game.id);
  const badge = getStatusBadge(status);

  row.innerHTML = `
    <div class="offline-game-row__info">
      <strong>${escapeHtml(game.name)}</strong>
      <span class="offline-game-row__desc">
        ${settings.showEstimatedSizes ? `~${formatBytes(size)} · ` : ""}${escapeHtml(game.description)}
      </span>
    </div>
    <div class="offline-game-row__status" id="status-${game.id}">
      <span class="status-badge ${badge.class}">${badge.label}</span>
    </div>
    <div class="offline-game-row__actions" id="actions-${game.id}">
    </div>
  `;

  // Add action button from the shared UI module helper
  const actionsEl = row.querySelector(`#actions-${game.id}`);
  if (actionsEl) {
    actionsEl.appendChild(
      createActionButton(game, status, () => {
        renderGameList();
        updateStorageInfo();
      })
    );
  }

  return row;
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
