/**
 * Minesweeper — entry point.
 *
 * Lazily loaded by the game screen when the user navigates to /games/minesweeper.
 * Pure CSS/DOM game.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createGame, MinesweeperRenderer } from "./game-minesweeper.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  container.style.overflow = "auto";

  const state = createGame();
  const renderer = new MinesweeperRenderer(state);
  renderer.mount(container);

  return () => {
    renderer.destroy();
    container.style.overflow = "";
  };
}
