import type { RouteState } from "../shared/game-types.js";

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

/** Parse the current hash into a RouteState. */
function parseHash(hash: string): RouteState {
  // Remove leading #/ or #
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

  return { route: "home", params: {} };
}

/** Match a route state against a registered pattern. */
function matchPattern(
  pattern: string,
  state: RouteState,
): Record<string, string> | null {
  const patternParts = pattern.replace(/^\//, "").split("/");
  let path: string[];

  switch (state.route) {
    case "home":
      path = [];
      break;
    case "game":
      path = ["games", ":gameId"];
      break;
    case "settings":
      path = ["settings"];
      break;
    case "offline":
      path = ["offline"];
      break;
    default:
      return null;
  }

  if (patternParts.length !== path.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = path[i];
    } else if (patternParts[i] !== path[i]) {
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
    const params = matchPattern(pattern, state);
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
  window.addEventListener("hashchange", handleRoute);
  // Handle the initial route
  handleRoute();
}

/** Get the current route state (read-only snapshot). */
export function getCurrentRoute(): Readonly<RouteState> {
  return currentState;
}
