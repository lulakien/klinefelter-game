import type { GameMeta } from "../../shared/game-types.js";
import { createInitialGameState, startAutoSave } from "../../core/game-lifecycle.js";
import { createSolitaireGame, SolitaireRenderer } from "./solitaire.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  container.style.overflow = "auto";
  const renderer = new SolitaireRenderer(
    createInitialGameState("solitaire", createSolitaireGame),
  );
  const autoSave = startAutoSave("solitaire", () => renderer.getState());
  renderer.mount(container);

  return () => {
    autoSave.stop();
    renderer.destroy();
    container.style.overflow = "";
  };
}
