export interface GameStatsRecord {
  gameId: string;
  gamesPlayed: number;
  totalPlaytimeSeconds: number;
  lastPlayed: number;
}

export interface StatsSnapshot {
  records: GameStatsRecord[];
  totalGamesPlayed: number;
  totalPlaytimeSeconds: number;
  favoriteGameId: string | null;
}

const STORAGE_KEY = "klinefelter-stats";
const MAX_GAMES = 100;

function parseStats(raw: string | null): GameStatsRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStatsRecord);
  } catch {
    return [];
  }
}

function isStatsRecord(value: unknown): value is GameStatsRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<GameStatsRecord>;
  return (
    typeof record.gameId === "string" &&
    Number.isFinite(record.gamesPlayed) &&
    Number.isFinite(record.totalPlaytimeSeconds) &&
    Number.isFinite(record.lastPlayed)
  );
}

function readStats(): GameStatsRecord[] {
  try {
    return parseStats(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeStats(records: GameStatsRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Stats are nice-to-have local data.
  }
}

export function recordGameStarted(gameId: string): void {
  const records = readStats();
  const existing = records.find((record) => record.gameId === gameId);
  if (existing) {
    existing.gamesPlayed++;
    existing.lastPlayed = Date.now();
  } else {
    records.push({
      gameId,
      gamesPlayed: 1,
      totalPlaytimeSeconds: 0,
      lastPlayed: Date.now(),
    });
  }

  // Cleanup: remove oldest games if exceeding MAX_GAMES
  if (records.length > MAX_GAMES) {
    const sortedByOldest = records.sort((a, b) => a.lastPlayed - b.lastPlayed);
    sortedByOldest.splice(0, records.length - MAX_GAMES);
  }

  writeStats(records);
}

export function recordGamePlaytime(gameId: string, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const records = readStats();
  const existing = records.find((record) => record.gameId === gameId);
  if (!existing) return;
  existing.totalPlaytimeSeconds += Math.round(seconds);
  existing.lastPlayed = Date.now();
  writeStats(records);
}

export function getStatsSnapshot(): StatsSnapshot {
  const records = readStats().sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  const totalGamesPlayed = records.reduce((sum, record) => sum + record.gamesPlayed, 0);
  const totalPlaytimeSeconds = records.reduce((sum, record) => sum + record.totalPlaytimeSeconds, 0);
  return {
    records,
    totalGamesPlayed,
    totalPlaytimeSeconds,
    favoriteGameId: records[0]?.gameId ?? null,
  };
}
