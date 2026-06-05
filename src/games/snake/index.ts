/**
 * Snake — entry point.
 *
 * Lazily loaded by the game screen when the user navigates to /games/snake.
 * Canvas-based game — warm toy-arcade design.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createSnakeGame, SnakeRenderer } from "./snake.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  container.style.overflow = "hidden";

  const state = createSnakeGame();
  const renderer = new SnakeRenderer(state);
  renderer.mount(container);

  return () => {
    renderer.destroy();
    container.style.overflow = "";
  };
}
