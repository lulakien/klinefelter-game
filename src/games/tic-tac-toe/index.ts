/**
 * Tic-Tac-Toe — entry point.
 *
 * Lazily loaded by the game screen when the user navigates to /games/tic-tac-toe.
 * CSS/DOM game — no Canvas needed.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createTicTacToeGame, TicTacToeRenderer } from "./tic-tac-toe.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  container.style.overflow = "auto";

  const state = createTicTacToeGame();
  const renderer = new TicTacToeRenderer(state);
  renderer.mount(container);

  return () => {
    renderer.destroy();
    container.style.overflow = "";
  };
}
