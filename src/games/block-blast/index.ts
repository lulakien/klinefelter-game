import type { GameMeta } from "../../shared/game-types.js";
import { createInitialGameState, startAutoSave } from "../../core/game-lifecycle.js";
import { BlockBlastRenderer, createBlockBlastGame } from "./block-blast.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  container.style.overflow = "auto";
  const renderer = new BlockBlastRenderer(
    createInitialGameState("block-blast", createBlockBlastGame),
  );
  const autoSave = startAutoSave("block-blast", () => renderer.getState());
  renderer.mount(container);

  return () => {
    autoSave.stop();
    renderer.destroy();
    container.style.overflow = "";
  };
}
