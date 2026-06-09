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
  {
    id: "solitaire",
    name: "Solitaire",
    description: "Klondike solitaire with draw-one stock, tableau stacks, and ace-to-king foundations.",
    version: "0.1.0",
    offlineSupport: "full",
    multiplayerSupport: "none",
    estimatedSizeLow: 90_000,
    estimatedSizeHigh: 220_000,
    supportsUltraLow: true,
    supportsHighQuality: true,
    controls: ["touch", "keyboard"],
    requiresBackend: false,
    entryModule: "../games/solitaire/index.js",
    tags: ["singleplayer", "offline", "cards", "classic"],
  },
  {
    id: "water-sort",
    name: "Water Sort",
    description: "Tap tubes to pour colors, using empty space to sort each tube into a single color.",
    version: "0.1.0",
    offlineSupport: "full",
    multiplayerSupport: "none",
    estimatedSizeLow: 70_000,
    estimatedSizeHigh: 180_000,
    supportsUltraLow: true,
    supportsHighQuality: true,
    controls: ["touch", "keyboard"],
    requiresBackend: false,
    entryModule: "../games/water-sort/index.js",
    tags: ["singleplayer", "offline", "puzzle", "casual"],
  },
  {
    id: "block-blast",
    name: "Block Blast",
    description: "Place three block shapes on an 8x8 board and clear complete rows or columns.",
    version: "0.1.0",
    offlineSupport: "full",
    multiplayerSupport: "none",
    estimatedSizeLow: 80_000,
    estimatedSizeHigh: 210_000,
    supportsUltraLow: true,
    supportsHighQuality: true,
    controls: ["touch", "keyboard"],
    requiresBackend: false,
    entryModule: "../games/block-blast/index.js",
    tags: ["singleplayer", "offline", "puzzle", "high-score"],
  },
  {
    id: "snake",
    name: "Snake",
    description: "Classic snake — eat food, grow longer, avoid walls and yourself!",
    version: "0.1.0",
    offlineSupport: "full",
    multiplayerSupport: "none",
    estimatedSizeLow: 60_000,
    estimatedSizeHigh: 150_000,
    supportsUltraLow: true,
    supportsHighQuality: true,
    controls: ["keyboard", "touch"],
    requiresBackend: false,
    entryModule: "../games/snake/index.js",
    tags: ["singleplayer", "offline", "arcade", "classic", "high-score"],
  },
  {
    id: "memory",
    name: "Memory",
    description: "Flip cards to find matching pairs. How few moves can you win in?",
    version: "0.1.0",
    offlineSupport: "full",
    multiplayerSupport: "none",
    estimatedSizeLow: 50_000,
    estimatedSizeHigh: 120_000,
    supportsUltraLow: true,
    supportsHighQuality: true,
    controls: ["touch", "keyboard"],
    requiresBackend: false,
    entryModule: "../games/memory/index.js",
    tags: ["singleplayer", "offline", "puzzle", "casual", "cards"],
  },
  {
    id: "15-puzzle",
    name: "15 Puzzle",
    description: "Slide numbered image tiles into order on a classic 4x4 board.",
    version: "0.1.0",
    offlineSupport: "full",
    multiplayerSupport: "none",
    estimatedSizeLow: 60_000,
    estimatedSizeHigh: 150_000,
    supportsUltraLow: true,
    supportsHighQuality: true,
    controls: ["touch", "keyboard"],
    requiresBackend: false,
    entryModule: "../games/15-puzzle/index.js",
    tags: ["singleplayer", "offline", "puzzle", "classic"],
  },
  {
    id: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    description: "Classic X and O. Play with a friend or challenge the AI.",
    version: "0.1.0",
    offlineSupport: "full",
    multiplayerSupport: "same-device",
    estimatedSizeLow: 30_000,
    estimatedSizeHigh: 80_000,
    supportsUltraLow: true,
    supportsHighQuality: true,
    controls: ["touch", "keyboard"],
    requiresBackend: false,
    entryModule: "../games/tic-tac-toe/index.js",
    tags: ["multiplayer", "same-device", "offline", "classic", "board"],
  },
  {
    id: "connect-four",
    name: "Connect Four",
    description: "Drop discs to connect four in a row. Same-device or vs AI.",
    version: "0.1.0",
    offlineSupport: "full",
    multiplayerSupport: "same-device",
    estimatedSizeLow: 35_000,
    estimatedSizeHigh: 90_000,
    supportsUltraLow: true,
    supportsHighQuality: true,
    controls: ["touch", "keyboard"],
    requiresBackend: false,
    entryModule: "../games/connect-four/index.js",
    tags: ["multiplayer", "same-device", "offline", "classic", "board"],
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
  "2048": () => import(/* viteChunkName: "game-2048" */ "../games/2048/index.js"),
  "minesweeper": () => import(/* viteChunkName: "game-minesweeper" */ "../games/minesweeper/index.js"),
  "solitaire": () => import(/* viteChunkName: "game-solitaire" */ "../games/solitaire/index.js"),
  "water-sort": () => import(/* viteChunkName: "game-water-sort" */ "../games/water-sort/index.js"),
  "block-blast": () => import(/* viteChunkName: "game-block-blast" */ "../games/block-blast/index.js"),
  "snake": () => import(/* viteChunkName: "game-snake" */ "../games/snake/index.js"),
  "memory": () => import(/* viteChunkName: "game-memory" */ "../games/memory/index.js"),
  "15-puzzle": () => import(/* viteChunkName: "game-15-puzzle" */ "../games/15-puzzle/index.js"),
  "tic-tac-toe": () => import(/* viteChunkName: "game-tic-tac-toe" */ "../games/tic-tac-toe/index.js"),
  "connect-four": () => import(/* viteChunkName: "game-connect-four" */ "../games/connect-four/index.js"),
};
