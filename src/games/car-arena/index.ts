/**
 * Drift Arena — entry point.
 *
 * Lazily loaded by the game screen when the user navigates to /games/car-arena.
 * Creates the Canvas, initializes the game, and returns a cleanup function.
 */

import type { GameMeta } from "../../shared/game-types.js";
import { getQualityMode } from "../../settings/settings-store.js";
import { CarGame } from "./car-game.js";

export async function mount(
  container: HTMLElement,
  _meta: GameMeta,
): Promise<() => void> {
  // Prevent page scrolling while playing
  container.style.overflow = "hidden";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.height = "100%";

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.id = "car-arena-canvas";
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  container.appendChild(canvas);

  // Read quality mode from settings
  const qualityMode = getQualityMode();

  // Create and start the game
  const game = new CarGame(qualityMode);
  game.start(canvas);

  // Handle window resize
  const onResize = () => game.handleResize();
  window.addEventListener("resize", onResize);

  // Return cleanup function
  return () => {
    window.removeEventListener("resize", onResize);
    // Always stop the game loop, even if other cleanup fails
    try {
      game.destroy();
    } catch (err) {
      console.error("Error destroying car game:", err);
    }
    // Always remove canvas, even if destroy threw
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
    // Reset container styles
    container.style.overflow = "";
    container.style.display = "";
    container.style.flexDirection = "";
    container.style.alignItems = "";
    container.style.justifyContent = "";
    container.style.height = "";
  };
}
