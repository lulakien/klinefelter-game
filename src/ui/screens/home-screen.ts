import { getAllGames, getGameSize } from "../../app/game-registry.js";
import { getQualityMode, getSettings } from "../../settings/settings-store.js";
import { getGameOfflineStatus } from "../../offline/package-manager.js";
import { getStatusBadge, formatBytes } from "../../offline/offline-manager-ui.js";
import type { GameMeta } from "../../shared/game-types.js";

/**
 * Home screen — the game launcher.
 */

export function renderHomeScreen(container: HTMLElement): void {
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

  const status = await getGameOfflineStatus(gameId);
  const badge = getStatusBadge(status);

  statusEl.innerHTML = `<span class="status-badge ${badge.class}">${badge.label}</span>`;
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
