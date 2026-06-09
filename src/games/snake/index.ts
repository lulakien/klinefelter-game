/**
 * Snake — entry point.
 *
 * Lazily loaded by the game screen when the user navigates to /games/snake.
 * Canvas-based game — warm toy-arcade design.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createInitialGameState, startAutoSave } from "../../core/game-lifecycle.js";
import { createSnakeGame, SnakeRenderer } from "./snake.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  container.style.overflow = "hidden";

  const state = createInitialGameState("snake", createSnakeGame);
  const renderer = new SnakeRenderer(state);
  const autoSave = startAutoSave("snake", () => renderer.getState());
  renderer.mount(container);

  return () => {
    autoSave.stop();
    renderer.destroy();
    container.style.overflow = "";
  };
}
