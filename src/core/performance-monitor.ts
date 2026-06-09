const STORAGE_KEY = "klinefelter-performance";
const MAX_RECORDS = 80;

export interface PerformanceRecord {
  gameId: string;
  type: "load" | "session";
  durationMs: number;
  timestamp: number;
  memoryMb?: number;
}

function readRecords(): PerformanceRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isPerformanceRecord) : [];
  } catch {
    return [];
  }
}

function writeRecords(records: PerformanceRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    // Performance monitoring is best-effort.
  }
}

function isPerformanceRecord(value: unknown): value is PerformanceRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PerformanceRecord>;
  return (
    typeof record.gameId === "string" &&
    (record.type === "load" || record.type === "session") &&
    Number.isFinite(record.durationMs) &&
    Number.isFinite(record.timestamp)
  );
}

export function recordPerformanceMetric(
  gameId: string,
  type: PerformanceRecord["type"],
  durationMs: number,
): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  const records = readRecords();
  records.unshift({
    gameId,
    type,
    durationMs: Math.round(durationMs),
    timestamp: Date.now(),
    memoryMb: getMemoryUsageMb(),
  });
  writeRecords(records);
}

export function getPerformanceRecords(): PerformanceRecord[] {
  return readRecords();
}

export function getPerformanceSummary(): { count: number; avgLoadMs: number; avgSessionMs: number } {
  const records = readRecords();
  const loads = records.filter((record) => record.type === "load");
  const sessions = records.filter((record) => record.type === "session");
  return {
    count: records.length,
    avgLoadMs: average(loads.map((record) => record.durationMs)),
    avgSessionMs: average(sessions.map((record) => record.durationMs)),
  };
}

export function exportPerformanceReport(): string {
  const records = readRecords();
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    summary: getPerformanceSummary(),
    records,
  }, null, 2);
}

export function clearPerformanceRecords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getMemoryUsageMb(): number | undefined {
  const perf = performance as Performance & { memory?: { usedJSHeapSize?: number } };
  const used = perf.memory?.usedJSHeapSize;
  return typeof used === "number" ? Math.round(used / 1024 / 1024) : undefined;
}
