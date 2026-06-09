import { AutoSaveManager, getSaveAge, loadGameState } from "./game-save-manager.js";

type TerminalState = {
  gameOver?: boolean;
  won?: boolean;
  draw?: boolean;
};

export function createInitialGameState<T>(
  gameId: string,
  createState: () => T,
): T {
  const saved = loadGameState<T>(gameId);
  if (
    saved &&
    typeof window !== "undefined" &&
    window.confirm(`Resume saved ${gameId} game from ${getSaveAge(saved)}?`)
  ) {
    return saved.state;
  }
  return createState();
}

export function startAutoSave<T extends TerminalState>(
  gameId: string,
  getState: () => T,
  version = "1.0.0",
): AutoSaveManager<T> {
  const manager = new AutoSaveManager<T>(gameId, version);
  manager.start(getState, 5, (state) => !state.gameOver && !state.won && !state.draw);
  return manager;
}
