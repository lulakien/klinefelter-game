/**
 * Connect Four — entry point.
 *
 * Lazily loaded by the game screen when the user navigates to /games/connect-four.
 * CSS/DOM game — no Canvas needed.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createInitialGameState, startAutoSave } from "../../core/game-lifecycle.js";
import { createConnectFourGame, ConnectFourRenderer } from "./connect-four.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
  options: { difficulty?: string } = {},
): Promise<() => void> {
  container.style.overflow = "auto";

  const state = createInitialGameState("connect-four", createConnectFourGame);
  if (options.difficulty === "easy" || options.difficulty === "hard") {
    state.difficulty = options.difficulty;
  }
  const renderer = new ConnectFourRenderer(state);
  const autoSave = startAutoSave("connect-four", () => renderer.getState());
  renderer.mount(container);

  return () => {
    autoSave.stop();
    renderer.destroy();
    container.style.overflow = "";
  };
}
