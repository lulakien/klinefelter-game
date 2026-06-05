/**
 * Memory — entry point.
 *
 * Lazily loaded by the game screen when the user navigates to /games/memory.
 * CSS/DOM game — no Canvas needed.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createMemoryGame, MemoryRenderer } from "./memory.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  container.style.overflow = "auto";

  const state = createMemoryGame();
  const renderer = new MemoryRenderer(state);
  renderer.mount(container);

  return () => {
    renderer.destroy();
    container.style.overflow = "";
  };
}
