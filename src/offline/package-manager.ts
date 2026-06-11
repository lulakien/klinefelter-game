/**
 * Offline package manager.
 *
 * Manages per-game caching using the Cache API + IndexedDB for metadata.
 * Coordinates with the service worker's `game-modules` cache.
 */

import type { GameOfflineStatus } from "../shared/game-types.js";
import { getAllGames, GAME_LOADERS, getGameSize } from "../app/game-registry.js";
import { getQualityMode } from "../settings/settings-store.js";

// ---- IndexedDB ----

const DB_NAME = "klinefelter-offline";
const DB_VERSION = 1;
const STORE_NAME = "packages";

interface PackageRecord {
  gameId: string;
  installedVersion: string;
  installedAt: number;
  qualityMode: string;
  sizeBytes: number;
  status: "installed" | "downloading" | "failed";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "gameId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getRecord(gameId: string): Promise<PackageRecord | undefined> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(gameId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
    tx.oncomplete = () => db.close();
  });
}

async function putRecord(record: PackageRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

async function deleteRecord(gameId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(gameId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

// ---- Cache API helpers ----

const GAME_CACHE_NAME = "game-modules";

async function isGameInCache(gameId: string): Promise<boolean> {
  if (!("caches" in window)) return false;

  try {
    const cache = await caches.open(GAME_CACHE_NAME);
    const keys = await cache.keys();
    const escapedGameId = gameId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`/game-${escapedGameId}-[^/]+\\.js$`);
    return keys.some((req) => pattern.test(req.url));
  } catch {
    return false;
  }
}

/** Get cache entries for a game. */
async function getGameCacheEntries(
  gameId: string,
): Promise<Request[]> {
  if (!("caches" in window)) return [];

  try {
    const cache = await caches.open(GAME_CACHE_NAME);
    const keys = await cache.keys();
    const escapedGameId = gameId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`/game-${escapedGameId}-[^/]+\\.js$`);
    return keys.filter((req) => pattern.test(req.url));
  } catch {
    return [];
  }
}

/** Remove all cached entries for a game. */
async function removeGameFromCache(gameId: string): Promise<void> {
  if (!("caches" in window)) return;

  try {
    const cache = await caches.open(GAME_CACHE_NAME);
    const entries = await getGameCacheEntries(gameId);
    await Promise.all(entries.map((req) => cache.delete(req)));
  } catch {
    // Cache unavailable
  }
}

// ---- Public API ----

export type DownloadProgress = {
  gameId: string;
  phase: "pending" | "downloading" | "complete" | "error";
  loaded: number;
  total: number;
  error?: string;
};

type ProgressCallback = (progress: DownloadProgress) => void;

/** Get the offline status for a specific game. */
export async function getGameOfflineStatus(
  gameId: string,
): Promise<GameOfflineStatus> {
  const game = getAllGames().find((g) => g.id === gameId);
  if (!game) return "not-downloaded";
  if (game.offlineSupport === "none") return "online-only";

  const record = await getRecord(gameId);

  // Check cache before version checks so stale IndexedDB records cannot mask missing cache entries.
  const cached = await isGameInCache(gameId);

  if (!cached) {
    // No cache means not downloaded, clean up any stale record
    await deleteRecord(gameId);
    return record ? "storage-removed" : "not-downloaded";
  }

  // Cache exists but no record - storage was removed partially
  if (!record) return "storage-removed";

  // Check for updates
  if (record.installedVersion !== game.version) {
    return "update-available";
  }

  return "offline-ready";
}

/** Get offline status for all games. */
export async function getAllGameStatuses(): Promise<
  Map<string, GameOfflineStatus>
> {
  const games = getAllGames();
  const map = new Map<string, GameOfflineStatus>();

  await Promise.all(
    games.map(async (g) => {
      map.set(g.id, await getGameOfflineStatus(g.id));
    }),
  );

  return map;
}

/** Download a game for offline use. Fetches all chunks to populate the cache. */
export async function downloadGame(
  gameId: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  const game = getAllGames().find((g) => g.id === gameId);
  if (!game) throw new Error(`Unknown game: ${gameId}`);

  onProgress?.({
    gameId,
    phase: "pending",
    loaded: 0,
    total: 0,
  });

  // Check if already installed
  const status = await getGameOfflineStatus(gameId);
  if (status === "offline-ready") {
    onProgress?.({ gameId, phase: "complete", loaded: 1, total: 1 });
    return;
  }

  // Load the game via its static loader to populate the SW cache.

  onProgress?.({
    gameId,
    phase: "downloading",
    loaded: 0,
    total: 1,
  });

  try {
    const loader = GAME_LOADERS[gameId];
    if (!loader) throw new Error(`No loader for game: ${gameId}`);

    await loader();
    onProgress?.({
      gameId,
      phase: "downloading",
      loaded: 1,
      total: 1,
    });

    // Verify it's now in cache
    const cached = await isGameInCache(gameId);

    if (cached) {
      const qualityMode = getQualityMode();
      await putRecord({
        gameId,
        installedVersion: game.version,
        installedAt: Date.now(),
        qualityMode,
        sizeBytes: getGameSize(game, qualityMode),
        status: "installed",
      });

      onProgress?.({ gameId, phase: "complete", loaded: 1, total: 1 });
    } else {
      throw new Error("Download completed but not found in cache");
    }
  } catch (err) {
    onProgress?.({
      gameId,
      phase: "error",
      loaded: 0,
      total: 0,
      error: err instanceof Error ? err.message : "Download failed",
    });
    throw err;
  }
}

/** Remove a game from offline storage. */
export async function removeGame(gameId: string): Promise<void> {
  await removeGameFromCache(gameId);
  await deleteRecord(gameId);
}

/** Check if an update is available for a game. */
export async function checkForUpdate(
  gameId: string,
): Promise<boolean> {
  const game = getAllGames().find((g) => g.id === gameId);
  if (!game) return false;

  const record = await getRecord(gameId);
  if (!record) return false;

  return record.installedVersion !== game.version;
}

/** Download all singleplayer games. */
export async function downloadAllSingleplayer(
  onProgress?: ProgressCallback,
): Promise<{ succeeded: string[]; failed: string[] }> {
  const games = getAllGames().filter(
    (g) => g.offlineSupport === "full" && !g.requiresBackend,
  );

  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const game of games) {
    try {
      await downloadGame(game.id, onProgress);
      succeeded.push(game.id);
    } catch {
      failed.push(game.id);
    }
  }

  return { succeeded, failed };
}

/** Get storage estimate. */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
} | null> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    try {
      const est = await navigator.storage.estimate();
      if (est.usage !== undefined && est.quota !== undefined) {
        return { usage: est.usage, quota: est.quota };
      }
    } catch {
      // Not available
    }
  }
  return null;
}

/** Request persistent storage. */
export async function requestPersistence(): Promise<boolean> {
  if ("storage" in navigator && "persist" in navigator.storage) {
    return navigator.storage.persist();
  }
  return false;
}
