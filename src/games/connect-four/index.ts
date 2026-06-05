/**
 * Connect Four — entry point.
 *
 * Lazily loaded by the game screen when the user navigates to /games/connect-four.
 * CSS/DOM game — no Canvas needed.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { createConnectFourGame, ConnectFourRenderer } from "./connect-four.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  container.style.overflow = "auto";

  const state = createConnectFourGame();
  const renderer = new ConnectFourRenderer(state);
  renderer.mount(container);

  return () => {
    renderer.destroy();
    container.style.overflow = "";
  };
}
