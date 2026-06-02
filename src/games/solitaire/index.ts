import type { GameMeta } from "../../shared/game-types.js";
import { createSolitaireGame, SolitaireRenderer } from "./solitaire.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  container.style.overflow = "auto";
  const renderer = new SolitaireRenderer(createSolitaireGame());
  renderer.mount(container);

  return () => {
    renderer.destroy();
    container.style.overflow = "";
  };
}
