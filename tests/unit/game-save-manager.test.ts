import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutoSaveManager,
  clearGameState,
  getSaveAge,
  loadGameState,
  saveGameState,
} from "../../src/core/game-save-manager.js";

describe("game-save-manager", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("round-trips valid saved state", () => {
    saveGameState("snake", { score: 40 }, "1.2.3");

    const save = loadGameState<{ score: number }>("snake");

    expect(save?.gameId).toBe("snake");
    expect(save?.version).toBe("1.2.3");
    expect(save?.state.score).toBe(40);
  });

  it("clears corrupt or mismatched saved state", () => {
    localStorage.setItem("klinefelter-save-snake", JSON.stringify({ gameId: "other" }));

    expect(loadGameState("snake")).toBeNull();
    expect(localStorage.getItem("klinefelter-save-snake")).toBeNull();
  });

  it("expires saves older than seven days", () => {
    const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      "klinefelter-save-snake",
      JSON.stringify({ gameId: "snake", timestamp: old, state: { score: 1 }, version: "1" }),
    );

    expect(loadGameState("snake")).toBeNull();
    expect(localStorage.getItem("klinefelter-save-snake")).toBeNull();
  });

  it("auto-saves active states and clears terminal states", () => {
    vi.useFakeTimers();
    let state = { score: 10, gameOver: false };
    const manager = new AutoSaveManager<typeof state>("snake");

    manager.start(() => state, 5, (snapshot) => !snapshot.gameOver);
    vi.advanceTimersByTime(5000);
    expect(loadGameState<typeof state>("snake")?.state.score).toBe(10);

    state = { score: 20, gameOver: true };
    vi.advanceTimersByTime(5000);
    expect(loadGameState("snake")).toBeNull();

    manager.stop();
  });

  it("formats fresh save age", () => {
    expect(getSaveAge({ gameId: "x", timestamp: Date.now(), state: {}, version: "1" })).toBe("just now");
    clearGameState("x");
  });
});
