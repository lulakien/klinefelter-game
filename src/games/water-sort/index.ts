import type { GameMeta } from "../../shared/game-types.js";
import { createInitialGameState, startAutoSave } from "../../core/game-lifecycle.js";
import { createWaterSortGame, WaterSortRenderer } from "./water-sort.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
  options: { difficulty?: string } = {},
): Promise<() => void> {
  container.style.overflow = "auto";
  const renderer = new WaterSortRenderer(
    createInitialGameState("water-sort", () =>
      createWaterSortGame(
        options.difficulty === "easy" ||
        options.difficulty === "hard" ||
        options.difficulty === "expert"
          ? options.difficulty
          : "medium",
      ),
    ),
  );
  const autoSave = startAutoSave("water-sort", () => renderer.getState());
  renderer.mount(container);

  return () => {
    autoSave.stop();
    renderer.destroy();
    container.style.overflow = "";
  };
}
