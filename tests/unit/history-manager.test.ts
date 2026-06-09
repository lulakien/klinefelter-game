import { describe, expect, it } from "vitest";
import { HistoryManager } from "../../src/core/history-manager.js";

describe("HistoryManager", () => {
  it("undos and redos immutable snapshots", () => {
    const history = new HistoryManager<{ value: number }>(2);
    const current = { value: 1 };

    history.push(current);
    current.value = 2;

    const previous = history.undo(current);
    expect(previous).toEqual({ value: 1 });

    const next = history.redo(previous!);
    expect(next).toEqual({ value: 2 });
  });

  it("limits history size", () => {
    const history = new HistoryManager<{ value: number }>(1);
    history.push({ value: 1 });
    history.push({ value: 2 });

    expect(history.undo({ value: 3 })).toEqual({ value: 2 });
    expect(history.undo({ value: 2 })).toBeNull();
  });
});
