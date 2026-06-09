/**
 * Tic-Tac-Toe — entry point.
 *
 * Lazily loaded by the game screen when the user navigates to /games/tic-tac-toe.
 * CSS/DOM game — no Canvas needed.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createInitialGameState, startAutoSave } from "../../core/game-lifecycle.js";
import { createTicTacToeGame, TicTacToeRenderer } from "./tic-tac-toe.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
  options: { difficulty?: string } = {},
): Promise<() => void> {
  container.style.overflow = "auto";

  const state = createInitialGameState("tic-tac-toe", createTicTacToeGame);
  if (options.difficulty === "easy" || options.difficulty === "hard") {
    state.difficulty = options.difficulty;
  }
  const renderer = new TicTacToeRenderer(state);
  const autoSave = startAutoSave("tic-tac-toe", () => renderer.getState());
  renderer.mount(container);

  return () => {
    autoSave.stop();
    renderer.destroy();
    container.style.overflow = "";
  };
}
