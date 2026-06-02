import { getSettings } from "./settings-store.js";

export interface ScoreRecord {
  gameId: string;
  score: number;
  date: number;
  nickname: string;
  formattedScore?: string;
}

const STORAGE_KEY = "klinefelter-scores";
const LEGACY_2048_BEST_KEY = "klinefelter-2048-best";

/** Retrieve sorted high scores for a specific game. */
export function getHighScores(gameId: string): ScoreRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const allScores = parseScores(raw);
      const scores = allScores
        .filter((s) => s.gameId === gameId)
        .sort((a, b) => compareScores(gameId, a, b));

      if (scores.length > 0) return scores;
    }
  } catch {
    // Ignore
  }
  return getLegacyScores(gameId);
}

/** Record a score for a game. Returns true if saved successfully. */
export function saveScore(gameId: string, score: number, formattedScore?: string): boolean {
  try {
    const settings = getSettings();
    const nickname = settings.nickname || "Player";
    const newRecord: ScoreRecord = {
      gameId,
      score,
      date: Date.now(),
      nickname,
      formattedScore,
    };

    const raw = localStorage.getItem(STORAGE_KEY);
    let allScores: ScoreRecord[] = [];
    if (raw) {
      try {
        allScores = parseScores(raw);
      } catch {
        allScores = [];
      }
    }

    allScores.push(newRecord);

    // Keep top 10 scores per game
    const gameScores = allScores
      .filter((s) => s.gameId === gameId)
      .sort((a, b) => compareScores(gameId, a, b))
      .slice(0, 10);

    // Filter out old scores for this game and merge back
    allScores = allScores.filter((s) => s.gameId !== gameId).concat(gameScores);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allScores));
    return true;
  } catch {
    return false;
  }
}

/** Get the player's single best record for a game. */
export function getPersonalBest(gameId: string): ScoreRecord | null {
  const scores = getHighScores(gameId);
  return scores[0] || null;
}

function compareScores(gameId: string, a: ScoreRecord, b: ScoreRecord): number {
  // Minesweeper records completion time, so lower is better.
  if (gameId === "minesweeper") {
    return a.score - b.score;
  }
  return b.score - a.score;
}

function parseScores(raw: string): ScoreRecord[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isScoreRecord);
}

function isScoreRecord(value: unknown): value is ScoreRecord {
  if (!value || typeof value !== "object") return false;

  const record = value as Partial<ScoreRecord>;
  return (
    typeof record.gameId === "string" &&
    typeof record.score === "number" &&
    Number.isFinite(record.score) &&
    typeof record.date === "number" &&
    typeof record.nickname === "string"
  );
}

function getLegacyScores(gameId: string): ScoreRecord[] {
  if (gameId !== "2048") return [];

  try {
    const legacyBest = Number(localStorage.getItem(LEGACY_2048_BEST_KEY) ?? 0);
    if (!Number.isFinite(legacyBest) || legacyBest <= 0) return [];

    return [{
      gameId,
      score: legacyBest,
      date: 0,
      nickname: getSettings().nickname || "Player",
      formattedScore: legacyBest.toLocaleString(),
    }];
  } catch {
    return [];
  }
}
