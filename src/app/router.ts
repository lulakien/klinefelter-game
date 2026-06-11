import type { RouteState } from "../shared/game-types.js";
import { logError } from "../core/error-logger.js";
import { renderOfflineScreen } from "../ui/screens/offline-screen.js";

/**
 * Simple hash-based client-side router.
 *
 * Uses hash fragments for routing (e.g., #/, #/games/car-arena, #/settings).
 * Hash routing avoids the need for server-side URL handling on static hosting.
 */

type RouteHandler = (params: Record<string, string>) => void;

const handlers = new Map<string, RouteHandler>();
let currentState: RouteState = { route: "home", params: {} };

/** Register a handler for a route pattern like "/games/:gameId". */
export function on(pattern: string, handler: RouteHandler): void {
  handlers.set(pattern, handler);
}

/** Navigate to a route. */
export function navigate(path: string): void {
  window.location.hash = path;
}

/** Extract the URL segments from the current hash. */
function getUrlSegments(): string[] {
  const hash = window.location.hash;
  const raw = hash.replace(/^#\/?/, "") || "/";
  const [path] = raw.split("?");
  return path.replace(/\/$/, "").split("/").filter(Boolean);
}

/** Parse the current hash into a RouteState. */
function parseHash(hash: string): RouteState {
  const raw = hash.replace(/^#\/?/, "") || "/";
  const [path] = raw.split("?");
  const segments = path.replace(/\/$/, "").split("/").filter(Boolean);

  if (segments.length === 0) {
    return { route: "home", params: {} };
  }

  if (segments[0] === "games" && segments.length >= 2) {
    return { route: "game", params: { gameId: segments[1] } };
  }

  if (segments[0] === "settings") {
    return { route: "settings", params: {} };
  }

  if (segments[0] === "offline") {
    return { route: "offline", params: {} };
  }

  if (segments[0] === "scores") {
    return { route: "scores", params: {} };
  }

  if (segments[0] === "stats") {
    return { route: "stats", params: {} };
  }

  return { route: "home", params: {} };
}

/** Match a registered pattern against the actual URL segments. */
function matchPattern(
  pattern: string,
): Record<string, string> | null {
  const patternParts = pattern.replace(/^\//, "").split("/").filter(Boolean);
  const urlSegments = getUrlSegments();

  if (patternParts.length !== urlSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      // Capture URL segment into the named parameter
      params[patternParts[i].slice(1)] = urlSegments[i];
    } else if (patternParts[i] !== urlSegments[i]) {
      return null;
    }
  }

  return params;
}

/** Handle the current hash change. */
function handleRoute(): void {
  const state = parseHash(window.location.hash);
  currentState = state;

  for (const [pattern, handler] of handlers) {
    const params = matchPattern(pattern);
    if (params) {
      handler(params);
      return;
    }
  }

  // Fallback: navigate home
  navigate("/");
}

/** Start listening for route changes. */
export function startRouter(): void {
  window.addEventListener("hashchange", () => {
    try {
      handleRoute();
    } catch (error) {
      logError(
        error instanceof Error ? error : new Error("Route handler failed"),
        `router:hashchange:${window.location.hash}`
      );
      const appContainer = document.getElementById("app");
      if (appContainer) {
        renderOfflineScreen(appContainer);
      }
    }
  });
  try {
    handleRoute();
  } catch (error) {
    logError(
      error instanceof Error ? error : new Error("Initial route handler failed"),
      `router:initial:${window.location.hash}`
    );
    const appContainer = document.getElementById("app");
    if (appContainer) {
      renderOfflineScreen(appContainer);
    }
  }
}

/** Get the current route state (read-only snapshot). */
export function getCurrentRoute(): Readonly<RouteState> {
  return currentState;
}
