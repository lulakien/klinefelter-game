import type { GameMeta } from "../../shared/game-types.js";
import { BlockBlastRenderer, createBlockBlastGame } from "./block-blast.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  container.style.overflow = "auto";
  const renderer = new BlockBlastRenderer(createBlockBlastGame());
  renderer.mount(container);

  return () => {
    renderer.destroy();
    container.style.overflow = "";
  };
}
