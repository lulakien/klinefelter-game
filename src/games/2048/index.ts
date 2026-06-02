/**
 * 2048 — entry point.
 *
 * Lazily loaded by the game screen when the user navigates to /games/2048.
 * Pure CSS/DOM game — no Canvas needed.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createGame, Game2048Renderer } from "./game-2048.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  // Prevent page scrolling while playing
  container.style.overflow = "auto";

  // Create game state
  const state = createGame();

  // Create renderer
  const renderer = new Game2048Renderer(state);
  renderer.mount(container);

  // Return cleanup function
  return () => {
    renderer.destroy();
    container.style.overflow = "";
  };
}
