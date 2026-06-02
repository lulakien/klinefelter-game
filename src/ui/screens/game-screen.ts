import { getGameById, GAME_LOADERS } from "../../app/game-registry.js";
import { setTopBarStatus, showErrorFallback } from "../../app/app-shell.js";
import { getGameOfflineStatus } from "../../offline/package-manager.js";
import { getSWStatus } from "../../pwa/register-sw.js";

/**
 * Game screen — loads and mounts a game module dynamically.
 *
 * Uses a generation counter to prevent stale async loads from mounting
 * after the user has already navigated elsewhere. Every call to
 * renderGameScreen cancels any in-flight load from a previous call.
 */

let currentCleanup: (() => void) | null = null;
let loadGeneration = 0;

/**
 * Load and mount a game. If called while another game is loading or
 * running, the old game is immediately destroyed and its async load
 * is cancelled via generation check.
 */
export async function renderGameScreen(
  container: HTMLElement,
  gameId: string,
): Promise<void> {
  // 1. Kill any running game synchronously before anything else
  destroyCurrentGame();

  // 2. Clear the container
  container.innerHTML = "";

  // 3. Bump generation so any in-flight load from a previous call bails out
  const myGeneration = ++loadGeneration;

  const game = getGameById(gameId);

  if (!game) {
    showErrorFallback(`Game not found: "${escapeHtml(gameId)}"`);
    return;
  }

  // Pre-flight check: block loading if offline and the game package isn't downloaded
  const status = await getGameOfflineStatus(gameId);
  const swStatus = getSWStatus();

  if (swStatus.offline && status !== "offline-ready") {
    showErrorFallback(
      `"${game.name}" is not downloaded. You must connect to the internet to download and play it.`
    );
    setTopBarStatus("");
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
    const module = await loader();

    // Check that no newer renderGameScreen call happened while we awaited
    if (myGeneration !== loadGeneration) {
      return; // Stale — a newer game was requested
    }

    // Ensure container is still clear (may have been repurposed)
    container.innerHTML = "";

    const cleanup = await module.mount(container, game);

    // Check again — the mount might have been async too
    if (myGeneration !== loadGeneration) {
      cleanup(); // Destroy the just-mounted game
      return;
    }

    currentCleanup = cleanup;
  } catch (err) {
    // Only show error if this is still the current load
    if (myGeneration === loadGeneration) {
      console.error(`Failed to load game "${gameId}":`, err);
      showErrorFallback(
        `Failed to load ${escapeHtml(game.name)}. It may not be downloaded for offline use.`,
      );
      setTopBarStatus("");
    }
  }
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

/** Destroy the currently mounted game and clean up all resources. */
export function destroyCurrentGame(): void {
  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (err) {
      console.error("Error during game cleanup:", err);
    }
    currentCleanup = null;
  }
  setTopBarStatus("");
}
