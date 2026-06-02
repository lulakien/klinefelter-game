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
  options: { exitToMenu?: () => void } = {},
): Promise<() => void> {
  const previousBodyOverflow = document.body.style.overflow;
  const previousBodyOverscroll = document.body.style.overscrollBehavior;
  const topBar = document.querySelector<HTMLElement>(".app-topbar");
  const previousTopBarDisplay = topBar?.style.display ?? "";
  document.body.style.overflow = "hidden";
  document.body.style.overscrollBehavior = "none";
  if (topBar) {
    topBar.style.display = "none";
  }

  const lockLandscape = async () => {
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      await orientation.lock?.("landscape");
    } catch {
      // Most mobile browsers require fullscreen/user gesture; the in-game
      // rotate overlay is the reliable fallback.
    }
  };
  void lockLandscape();

  // Prevent page scrolling while playing
  container.style.overflow = "hidden";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.width = "100vw";
  container.style.minHeight = "320px";
  container.style.position = "relative";

  const syncViewportSize = () => {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
  };
  syncViewportSize();

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
  const game = new CarGame(qualityMode, options.exitToMenu);
  game.start(canvas);

  // Handle window resize
  const onViewportResize = () => {
    syncViewportSize();
    game.handleResize();
  };
  window.addEventListener("resize", onViewportResize);
  window.visualViewport?.addEventListener("resize", onViewportResize);
  window.visualViewport?.addEventListener("scroll", onViewportResize);

  // Return cleanup function
  return () => {
    window.removeEventListener("resize", onViewportResize);
    window.visualViewport?.removeEventListener("resize", onViewportResize);
    window.visualViewport?.removeEventListener("scroll", onViewportResize);
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
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.overscrollBehavior = previousBodyOverscroll;
    if (topBar) {
      topBar.style.display = previousTopBarDisplay;
    }
    try {
      screen.orientation?.unlock?.();
    } catch {
      // Ignore unsupported orientation APIs.
    }
    container.style.overflow = "";
    container.style.display = "";
    container.style.flexDirection = "";
    container.style.alignItems = "";
    container.style.justifyContent = "";
    container.style.height = "";
    container.style.width = "";
    container.style.minHeight = "";
    container.style.position = "";
  };
}
