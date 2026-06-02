import { getGameById } from "../../app/game-registry.js";
import { setTopBarStatus, showErrorFallback } from "../../app/app-shell.js";
import type { GameMeta } from "../../shared/game-types.js";

/**
 * Game screen — loads and mounts a game module dynamically.
 *
 * This is the lazy-load boundary. When a user navigates to /games/:id,
 * this screen dynamically imports the game's entry module and mounts it.
 *
 * IMPORTANT: Each game must be registered in GAME_LOADERS below using a
 * literal import() path so Vite can statically analyze and code-split.
 */

type MountFn = (
  container: HTMLElement,
  meta: GameMeta,
) => Promise<() => void>;

/** Static map of game ID → loader function. Vite code-splits each entry. */
const GAME_LOADERS: Record<string, () => Promise<{ mount: MountFn }>> = {
  "car-arena": () => import("../../games/car-arena/index.js"),
  "2048": () => import("../../games/2048/index.js"),
  "minesweeper": () => import("../../games/minesweeper/index.js"),
};

let currentCleanup: (() => void) | null = null;

export async function renderGameScreen(
  container: HTMLElement,
  gameId: string,
): Promise<void> {
  // Clean up any previously mounted game
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const game = getGameById(gameId);

  if (!game) {
    showErrorFallback(`Game not found: "${gameId}"`);
    return;
  }

  setTopBarStatus(game.name);

  // Show loading state
  container.innerHTML = `
    <div class="game-loading">
      <p>Loading ${escapeHtml(game.name)}...</p>
    </div>
  `;

  const loader = GAME_LOADERS[gameId];

  if (!loader) {
    showErrorFallback(
      `Game "${escapeHtml(game.name)}" is not yet implemented.`,
    );
    setTopBarStatus("");
    return;
  }

  try {
    // Dynamic import — Vite code-splits each game into its own chunk
    const module = await loader();
    currentCleanup = await module.mount(container, game);
  } catch (err) {
    console.error(`Failed to load game "${gameId}":`, err);
    showErrorFallback(
      `Failed to load ${escapeHtml(game.name)}. It may not be downloaded for offline use.`,
    );
    setTopBarStatus("");
  }
}

/** Pause the currently mounted game (called on route change). */
export function pauseCurrentGame(): void {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
