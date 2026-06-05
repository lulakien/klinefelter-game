/**
 * 15 Puzzle — entry point.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createPuzzle15Game, Puzzle15Renderer } from "./puzzle-15.js";

export async function mount(container: HTMLElement, _meta: GameMeta): Promise<() => void> {
  const state = createPuzzle15Game();
  const renderer = new Puzzle15Renderer(state);
  renderer.mount(container);

  return () => {
    renderer.destroy();
  };
}
