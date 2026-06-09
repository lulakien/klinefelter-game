import { getAllGames, getGameSize } from "../../app/game-registry.js";
import { getQualityMode, getSettings } from "../../settings/settings-store.js";
import { getGameOfflineStatus } from "../../offline/package-manager.js";
import { getStatusBadge, formatBytes } from "../../offline/offline-manager-ui.js";
import { onSWStatusChange, getSWStatus, getDeferredPrompt, clearDeferredPrompt, type SWStatus } from "../../pwa/register-sw.js";
import { setScreenCleanup } from "../../app/app-shell.js";
import { getPersonalBest } from "../../settings/scores-store.js";
import type { GameMeta, GameOfflineStatus } from "../../shared/game-types.js";

/**
 * Home screen — the game launcher.
 */

let unsubSW: (() => void) | null = null;

export function renderHomeScreen(container: HTMLElement): void {
  // Clear any existing listener first
  if (unsubSW) {
    unsubSW();
    unsubSW = null;
  }

  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "home-screen";

  // Hero
  const hero = document.createElement("div");
  hero.className = "home-hero";
  hero.innerHTML = `
    <h1 class="home-hero__title">Mini Game Portal</h1>
    <p class="home-hero__subtitle">
      Download once, play offline. No ads. No trackers.
    </p>
  `;
  wrapper.appendChild(hero);

  // Install Banner container
  const bannerContainer = document.createElement("div");
  bannerContainer.id = "install-banner-container";
  wrapper.appendChild(bannerContainer);

  // Quick actions
  const actions = document.createElement("div");
  actions.className = "home-actions";
  actions.innerHTML = `
    <a class="btn btn--secondary" href="#/settings">Settings</a>
    <a class="btn btn--secondary" href="#/offline">Offline Manager</a>
  `;
  wrapper.appendChild(actions);

  // Game grid
  const grid = document.createElement("div");
  grid.className = "game-grid";

  const games = getAllGames();
  for (const game of games) {
    grid.appendChild(createGameCard(game));
  }

  wrapper.appendChild(grid);
  container.appendChild(wrapper);

  // Update status badges asynchronously
  for (const game of games) {
    updateGameCardStatus(game.id);
  }

  // Subscribe to SW status changes
  unsubSW = onSWStatusChange((status) => {
    renderInstallBanner(bannerContainer, status);
    // Refresh card states to handle offline/online transition
    for (const game of games) {
      updateGameCardStatus(game.id);
    }
  });

  // Register screen cleanup to prevent leaks
  setScreenCleanup(() => {
    if (unsubSW) {
      unsubSW();
      unsubSW = null;
    }
  });
}

function renderInstallBanner(container: HTMLElement, status: SWStatus): void {
  container.innerHTML = "";

  const iosInstallable = isIOS() && !isStandalone();
  const webInstallable = status.installable;

  if (!iosInstallable && !webInstallable) {
    return;
  }

  const banner = document.createElement("div");
  banner.className = "install-banner";
  banner.innerHTML = `
    <div class="install-banner__content">
      <h3>Install App</h3>
      <p>Add to your home screen for quick, full-screen offline access.</p>
    </div>
    <button class="btn btn--primary" id="btn-install-app">Install</button>
  `;

  container.appendChild(banner);

  const installBtn = banner.querySelector("#btn-install-app");
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (iosInstallable) {
        showIOSInstructionsModal();
      } else {
        const promptEvent = getDeferredPrompt();
        if (!promptEvent) return;
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === "accepted") {
          clearDeferredPrompt();
        }
      }
    });
  }
}

function createGameCard(game: GameMeta): HTMLElement {
  const card = document.createElement("a");
  card.className = "game-card";
  card.href = `#/games/${game.id}`;

  const qualityMode = getQualityMode();
  const size = getGameSize(game, qualityMode);
  const sizeLabel = formatBytes(size);
  const settings = getSettings();

  const offlineLabel =
    game.offlineSupport === "full"
      ? "Offline: Yes"
      : game.offlineSupport === "partial"
        ? "Offline: Partial"
        : "Online only";

  const controlsLabel = game.controls
    .map((c) => c[0].toUpperCase() + c.slice(1))
    .join(" + ");

  const pb = getPersonalBest(game.id);
  const pbLabel = pb ? `PB: ${pb.formattedScore || pb.score}` : "PB: None";
  const pbTitle = pb
    ? `Best by ${pb.nickname}${pb.date ? ` on ${new Date(pb.date).toLocaleDateString()}` : ""}`
    : "No personal best yet";

  card.innerHTML = `
    <div class="game-card__header">
      <h2 class="game-card__name">${escapeHtml(game.name)}</h2>
      <span class="game-card__tag">${game.tags[0] ?? ""}</span>
    </div>
    <p class="game-card__desc">${escapeHtml(game.description)}</p>
    <div class="game-card__meta">
      <span>${offlineLabel}</span>
      ${settings.showEstimatedSizes ? `<span>Size: ${sizeLabel}</span>` : ""}
      <span>Controls: ${controlsLabel}</span>
      <span class="game-card__pb" title="${escapeHtml(pbTitle)}">${escapeHtml(pbLabel)}</span>
    </div>
    <div class="game-card__status" id="card-status-${game.id}">
      <span class="status-badge status-badge--not-downloaded">Checking...</span>
    </div>
  `;

  return card;
}

async function updateGameCardStatus(gameId: string): Promise<void> {
  const statusEl = document.getElementById(`card-status-${gameId}`);
  if (!statusEl) return;

  const card = statusEl.closest(".game-card") as HTMLElement | null;

  // Add timeout to prevent hanging "Checking..." state
  const timeoutId = setTimeout(() => {
    statusEl.innerHTML = `<span class="status-badge status-badge--not-downloaded">Check Failed</span>`;
  }, 3000);

  let status: GameOfflineStatus;
  try {
    status = await getGameOfflineStatus(gameId);
    clearTimeout(timeoutId);
  } catch {
    clearTimeout(timeoutId);
    status = "not-downloaded";
  }
  const swStatus = getSWStatus();

  let badge = getStatusBadge(status);

  if (swStatus.offline && status !== "offline-ready") {
    badge = { class: "status-badge--not-downloaded", label: "Needs Internet" };
    if (card) {
      card.classList.add("game-card--disabled");
      card.removeAttribute("href");
    }
  } else {
    if (card) {
      card.classList.remove("game-card--disabled");
      card.setAttribute("href", `#/games/${gameId}`);
    }
  }

  statusEl.innerHTML = `<span class="status-badge ${badge.class}">${badge.label}</span>`;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

function showIOSInstructionsModal(): void {
  const modal = document.createElement("div");
  modal.className = "ios-modal-overlay";
  modal.id = "ios-install-modal";
  modal.innerHTML = `
    <div class="ios-modal">
      <div class="ios-modal__header">
        <h3>Install Klinefelter Game</h3>
        <button class="ios-modal__close" id="ios-modal-close">&times;</button>
      </div>
      <div class="ios-modal__body">
        <p>To install this game portal on your iPhone or iPad, follow these simple steps in <strong>Safari</strong>:</p>
        <ol class="ios-install-steps">
          <li>
            <div class="ios-step-num">1</div>
            <div class="ios-step-text">Tap the <strong>Share</strong> button in Safari's browser menu.</div>
            <div class="ios-step-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </div>
          </li>
          <li>
            <div class="ios-step-num">2</div>
            <div class="ios-step-text">Scroll down the share menu and select <strong>Add to Home Screen</strong>.</div>
            <div class="ios-step-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            </div>
          </li>
          <li>
            <div class="ios-step-num">3</div>
            <div class="ios-step-text">Tap <strong>Add</strong> in the top-right corner to complete.</div>
          </li>
        </ol>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close button event
  const closeBtn = modal.querySelector("#ios-modal-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.classList.add("ios-modal-overlay--closing");
      setTimeout(() => modal.remove(), 250);
    });
  }

  // Close on tap outside
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("ios-modal-overlay--closing");
      setTimeout(() => modal.remove(), 250);
    }
  });
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
