/**
 * 15 Puzzle — entry point.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createInitialGameState, startAutoSave } from "../../core/game-lifecycle.js";
import { createPuzzle15Game, Puzzle15Renderer } from "./puzzle-15.js";

export async function mount(container: HTMLElement, _meta: GameMeta): Promise<() => void> {
  const state = createInitialGameState("15-puzzle", createPuzzle15Game);
  const renderer = new Puzzle15Renderer(state);
  const autoSave = startAutoSave("15-puzzle", () => renderer.getState());
  renderer.mount(container);

  return () => {
    autoSave.stop();
    renderer.destroy();
  };
}
