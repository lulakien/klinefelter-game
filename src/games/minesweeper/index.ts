/**
 * Minesweeper — entry point.
 *
 * Lazily loaded by the game screen when the user navigates to /games/minesweeper.
 * Pure CSS/DOM game.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createInitialGameState, startAutoSave } from "../../core/game-lifecycle.js";
import { createGame, MinesweeperRenderer } from "./game-minesweeper.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
  options: { difficulty?: string } = {},
): Promise<() => void> {
  container.style.overflow = "auto";

  const state = createInitialGameState("minesweeper", () =>
    createGame(
      options.difficulty === "intermediate" || options.difficulty === "expert"
        ? options.difficulty
        : "beginner",
    ),
  );
  const renderer = new MinesweeperRenderer(state);
  const autoSave = startAutoSave("minesweeper", () => renderer.getState());
  renderer.mount(container);

  return () => {
    autoSave.stop();
    renderer.destroy();
    container.style.overflow = "";
  };
}
