import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPerformanceRecords,
  exportPerformanceReport,
  getPerformanceSummary,
  recordPerformanceMetric,
} from "../../src/core/performance-monitor.js";

describe("performance-monitor", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("records load and session metrics", () => {
    recordPerformanceMetric("snake", "load", 123.4);
    recordPerformanceMetric("snake", "session", 2000);

    const summary = getPerformanceSummary();

    expect(summary.count).toBe(2);
    expect(summary.avgLoadMs).toBe(123);
    expect(summary.avgSessionMs).toBe(2000);
    expect(JSON.parse(exportPerformanceReport()).records).toHaveLength(2);
  });

  it("ignores corrupt storage and can clear records", () => {
    localStorage.setItem("klinefelter-performance", "{broken");
    expect(getPerformanceSummary().count).toBe(0);

    recordPerformanceMetric("snake", "load", 10);
    clearPerformanceRecords();
    expect(getPerformanceSummary().count).toBe(0);
  });
});
