import { beforeEach, describe, expect, it } from "vitest";
import { createGame, move } from "../../src/games/2048/game-2048.js";

describe("2048 logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a board with two starting tiles", () => {
    const state = createGame();

    expect(state.tiles).toHaveLength(2);
    expect(state.grid.flat().filter(Boolean)).toHaveLength(2);
  });

  it("moves tiles without throwing and updates board consistency", () => {
    const state = createGame();
    move(state, "left");

    for (const tile of state.tiles) {
      expect(state.grid[tile.row][tile.col]).toBe(tile);
    }
  });
});
