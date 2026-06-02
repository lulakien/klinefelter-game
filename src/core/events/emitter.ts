/**
 * Tiny typed event emitter used for cross-module communication
 * without coupling modules directly.
 */

type Listener<T> = (payload: T) => void;

class Emitter<T> {
  private listeners = new Set<Listener<T>>();

  on(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(payload: T): void {
    for (const fn of this.listeners) {
      fn(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Create a new typed event channel. */
export function createEmitter<T>(): Emitter<T> {
  return new Emitter<T>();
}
