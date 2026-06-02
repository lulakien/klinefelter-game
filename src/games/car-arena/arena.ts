/**
 * Arena definitions for Drift Arena.
 *
 * Each arena is a 2000x1400 virtual-unit rectangular space with
 * walls, obstacles, and token spawn points.
 */

import type { Obstacle, ArenaBounds } from "./physics/collision.js";

export interface TokenSpawn {
  x: number;
  y: number;
}

export interface Arena {
  bounds: ArenaBounds;
  obstacles: Obstacle[];
  tokenSpawns: TokenSpawn[];
  /** Player spawn position */
  playerSpawn: { x: number; y: number };
  /** Bot spawn positions */
  botSpawns: { x: number; y: number }[];
}

/**
 * The default arena — a rounded rectangle with scattered obstacles.
 * Designed for 1 player + 3 bots.
 */
export function createDefaultArena(): Arena {
  const bounds: ArenaBounds = {
    minX: 50,
    minY: 50,
    maxX: 1950,
    maxY: 1350,
  };

  const obstacles: Obstacle[] = [
    // Center structure (large rectangle)
    { type: "rect", rect: { x: 1000, y: 700, width: 120, height: 200 } },

    // Scattered pillars
    { type: "circle", circle: { x: 300, y: 300, radius: 40 } },
    { type: "circle", circle: { x: 500, y: 600, radius: 50 } },
    { type: "circle", circle: { x: 700, y: 200, radius: 35 } },
    { type: "circle", circle: { x: 300, y: 1000, radius: 45 } },
    { type: "circle", circle: { x: 600, y: 1100, radius: 40 } },
    { type: "circle", circle: { x: 1400, y: 300, radius: 40 } },
    { type: "circle", circle: { x: 1700, y: 500, radius: 50 } },
    { type: "circle", circle: { x: 1500, y: 900, radius: 35 } },
    { type: "circle", circle: { x: 1300, y: 1200, radius: 45 } },
    { type: "circle", circle: { x: 1700, y: 1100, radius: 40 } },
    { type: "circle", circle: { x: 900, y: 350, radius: 30 } },
    { type: "circle", circle: { x: 1100, y: 1050, radius: 30 } },

    // Some walls / barriers
    { type: "rect", rect: { x: 800, y: 400, width: 30, height: 100 } },
    { type: "rect", rect: { x: 1200, y: 950, width: 30, height: 100 } },
    { type: "rect", rect: { x: 400, y: 700, width: 100, height: 30 } },
    { type: "rect", rect: { x: 1600, y: 700, width: 100, height: 30 } },
  ];

  const tokenSpawns: TokenSpawn[] = [];
  // Generate token spawns in open areas
  const spawnPositions = [
    { x: 200, y: 150 }, { x: 500, y: 150 }, { x: 800, y: 150 },
    { x: 1200, y: 150 }, { x: 1500, y: 150 }, { x: 1800, y: 150 },
    { x: 200, y: 500 }, { x: 400, y: 350 }, { x: 700, y: 500 },
    { x: 1300, y: 500 }, { x: 1600, y: 350 }, { x: 1800, y: 500 },
    { x: 200, y: 900 }, { x: 400, y: 1100 }, { x: 700, y: 800 },
    { x: 1300, y: 800 }, { x: 1600, y: 1050 }, { x: 1800, y: 900 },
    { x: 500, y: 1300 }, { x: 900, y: 600 }, { x: 1100, y: 600 },
    { x: 900, y: 800 }, { x: 1100, y: 800 }, { x: 1500, y: 1300 },
  ];

  for (const pos of spawnPositions) {
    // Avoid placing tokens inside obstacles
    let blocked = false;
    for (const obs of obstacles) {
      if (obs.type === "circle") {
        const dx = pos.x - obs.circle.x;
        const dy = pos.y - obs.circle.y;
        if (Math.sqrt(dx * dx + dy * dy) < obs.circle.radius + 30) {
          blocked = true;
          break;
        }
      } else if (obs.type === "rect") {
        const halfW = obs.rect.width / 2 + 30;
        const halfH = obs.rect.height / 2 + 30;
        if (
          Math.abs(pos.x - obs.rect.x) < halfW &&
          Math.abs(pos.y - obs.rect.y) < halfH
        ) {
          blocked = true;
          break;
        }
      }
    }
    if (!blocked) {
      tokenSpawns.push(pos);
    }
  }

  return {
    bounds,
    obstacles,
    tokenSpawns,
    playerSpawn: { x: 300, y: 200 },
    botSpawns: [
      { x: 1700, y: 200 },
      { x: 300, y: 1200 },
      { x: 1700, y: 1200 },
    ],
  };
}
