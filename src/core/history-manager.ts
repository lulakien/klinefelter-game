export class HistoryManager<T> {
  private past: T[] = [];
  private future: T[] = [];
  private maxSize: number;

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  push(state: T): void {
    this.past.push(clone(state));
    if (this.past.length > this.maxSize) {
      this.past.shift();
    }
    this.future = [];
  }

  undo(current: T): T | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(clone(current));
    return clone(previous);
  }

  redo(current: T): T | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(clone(current));
    return clone(next);
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
