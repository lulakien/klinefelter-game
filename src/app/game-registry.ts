import type { GameMeta } from "../shared/game-types.js";

/**
 * Central game registry.
 *
 * Every game in the portal is registered here. The home page reads this
 * to render game cards; the router uses it to lazy-load game modules.
 *
 * IMPORTANT: Do NOT import game modules at the top of this file.
 * Game code must only be loaded when the user navigates to a game route.
 */

const registry: GameMeta[] = [
  {
    id: "car-arena",
    name: "Drift Arena",
    description: "Top-down car arena game with drifting and collisions.",
    version: "0.1.0",
    offlineSupport: "full",
    multiplayerSupport: "none", // singleplayer now, online later
    estimatedSizeLow: 1_500_000, // ~1.5 MB
    estimatedSizeHigh: 4_500_000, // ~4.5 MB
    supportsUltraLow: true,
    supportsHighQuality: true,
    controls: ["keyboard", "touch"],
    requiresBackend: false,
    entryModule: "../games/car-arena/index.js",
    tags: ["singleplayer", "offline", "car", "arcade", "action"],
  },
  {
    id: "2048",
    name: "2048",
    description: "Slide and merge tiles to reach 2048.",
    version: "0.1.0",
    offlineSupport: "full",
    multiplayerSupport: "none",
    estimatedSizeLow: 150_000, // ~150 KB
    estimatedSizeHigh: 400_000, // ~400 KB
    supportsUltraLow: true,
    supportsHighQuality: true,
    controls: ["keyboard", "touch"],
    requiresBackend: false,
    entryModule: "../games/2048/index.js",
    tags: ["singleplayer", "offline", "puzzle", "casual"],
  },
  {
    id: "minesweeper",
    name: "Minesweeper",
    description: "Classic mine-clearing puzzle. Flag all the mines!",
    version: "0.1.0",
    offlineSupport: "full",
    multiplayerSupport: "none",
    estimatedSizeLow: 80_000, // ~80 KB
    estimatedSizeHigh: 200_000, // ~200 KB
    supportsUltraLow: true,
    supportsHighQuality: true,
    controls: ["keyboard", "touch"],
    requiresBackend: false,
    entryModule: "../games/minesweeper/index.js",
    tags: ["singleplayer", "offline", "puzzle", "classic"],
  },
];

/** Get all registered games. */
export function getAllGames(): ReadonlyArray<GameMeta> {
  return registry;
}

/** Look up a game by its id. */
export function getGameById(id: string): GameMeta | undefined {
  return registry.find((g) => g.id === id);
}

/** Get the estimated package size for a game given a quality mode. */
export function getGameSize(game: GameMeta, qualityMode: string): number {
  return qualityMode === "ultra-low"
    ? game.estimatedSizeLow
    : game.estimatedSizeHigh;
}

/** Dynamic game loader map with chunk names. */
export const GAME_LOADERS: Record<string, () => Promise<any>> = {
  "car-arena": () => import(/* viteChunkName: "game-car-arena" */ "../games/car-arena/index.js"),
  "2048": () => import(/* viteChunkName: "game-2048" */ "../games/2048/index.js"),
  "minesweeper": () => import(/* viteChunkName: "game-minesweeper" */ "../games/minesweeper/index.js"),
};
