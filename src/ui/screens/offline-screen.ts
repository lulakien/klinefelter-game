import { getAllGames, getGameSize } from "../../app/game-registry.js";
import { getSWStatus, onSWStatusChange } from "../../pwa/register-sw.js";
import { getQualityMode, getSettings } from "../../settings/settings-store.js";
import {
  getGameOfflineStatus,
  downloadGame,
  removeGame,
  downloadAllSingleplayer,
  getStorageEstimate,
  requestPersistence,
} from "../../offline/package-manager.js";
import {
  formatBytes,
  getStatusBadge,
} from "../../offline/offline-manager-ui.js";
import type { GameMeta, GameOfflineStatus } from "../../shared/game-types.js";

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
      <p>Connection: <span class="status-badge" id="badge-connection">...</span></p>
      <p>Service Worker: <span class="status-badge" id="badge-sw">...</span></p>
    </section>

    <section class="offline-section">
      <h2>Storage</h2>
      <p id="storage-estimate">Estimating...</p>
      <button class="btn btn--small btn--secondary" id="btn-persist" style="display:none;">
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
  if (downloadAllBtn && swStatus.offline) {
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = "Offline — Cannot Download";
  }
}

async function updateStorageInfo(): Promise<void> {
  const el = document.getElementById("storage-estimate");
  if (!el) return;

  const est = await getStorageEstimate();
  if (est) {
    el.textContent = `Using ${formatBytes(est.usage)} of ${formatBytes(est.quota)}`;
  } else {
    el.textContent = "Storage API not available in this browser.";
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

  for (const game of games) {
    const row = await createGameRow(game);
    list.appendChild(row);
  }

  // Download all button
  const downloadAllBtn = document.getElementById("btn-download-all") as HTMLButtonElement | null;
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener("click", async () => {
      downloadAllBtn.disabled = true;
      downloadAllBtn.textContent = "Downloading...";
      const { succeeded, failed } = await downloadAllSingleplayer();
      downloadAllBtn.textContent = `Done: ${succeeded.length} OK, ${failed.length} failed`;
      setTimeout(() => renderGameList(), 1500);
    });
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

  // Add action button
  const actionsEl = row.querySelector(`#actions-${game.id}`);
  if (actionsEl) {
    actionsEl.appendChild(createActionBtn(game, status, () => renderGameList()));
  }

  return row;
}

function createActionBtn(
  game: GameMeta,
  status: GameOfflineStatus,
  onRefresh: () => void,
): HTMLElement {
  const btn = document.createElement("button");
  btn.className = "btn btn--small";

  if (status === "online-only") {
    btn.textContent = "Online only";
    btn.disabled = true;
    return btn;
  }

  if (status === "not-downloaded" || status === "storage-removed" || status === "update-available") {
    btn.textContent = "Download";
    btn.addEventListener("click", async () => {
      btn.textContent = "Downloading...";
      btn.disabled = true;
      try {
        await downloadGame(game.id);
      } catch {
        btn.textContent = "Retry";
        btn.disabled = false;
        return;
      }
      onRefresh();
    });
    return btn;
  }

  if (status === "offline-ready") {
    btn.textContent = "Remove";
    btn.className = "btn btn--small btn--secondary";
    btn.addEventListener("click", async () => {
      btn.textContent = "Removing...";
      btn.disabled = true;
      try {
        await removeGame(game.id);
      } catch {
        btn.textContent = "Error";
        btn.disabled = false;
        return;
      }
      onRefresh();
    });
    return btn;
  }

  btn.textContent = "—";
  btn.disabled = true;
  return btn;
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
