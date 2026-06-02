import type { GameMeta } from "../../shared/game-types.js";
import { createWaterSortGame, WaterSortRenderer } from "./water-sort.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  container.style.overflow = "auto";
  const renderer = new WaterSortRenderer(createWaterSortGame());
  renderer.mount(container);

  return () => {
    renderer.destroy();
    container.style.overflow = "";
  };
}
