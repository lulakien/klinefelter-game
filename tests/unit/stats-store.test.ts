import { beforeEach, describe, expect, it } from "vitest";
import {
  getStatsSnapshot,
  recordGamePlaytime,
  recordGameStarted,
} from "../../src/settings/stats-store.js";

describe("stats-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("tracks plays, favorite game, and playtime", () => {
    recordGameStarted("snake");
    recordGameStarted("snake");
    recordGameStarted("2048");
    recordGamePlaytime("snake", 12.4);

    const snapshot = getStatsSnapshot();

    expect(snapshot.totalGamesPlayed).toBe(3);
    expect(snapshot.favoriteGameId).toBe("snake");
    expect(snapshot.records.find((record) => record.gameId === "snake")?.totalPlaytimeSeconds).toBe(12);
  });

  it("ignores corrupt storage and invalid playtime", () => {
    localStorage.setItem("klinefelter-stats", "{broken");
    recordGamePlaytime("snake", Number.NaN);

    expect(getStatsSnapshot().totalGamesPlayed).toBe(0);
  });
});
