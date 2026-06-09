import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearErrorLogs,
  exportErrorLogs,
  getErrorCount,
  getErrorLogs,
  installGlobalErrorHandlers,
  logError,
} from "../../src/core/error-logger.js";

describe("error-logger", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("records and exports errors with context", () => {
    logError(new Error("boom"), "unit-test");

    expect(getErrorCount()).toBe(1);
    expect(getErrorLogs()[0].context).toBe("unit-test");
    expect(JSON.parse(exportErrorLogs()).totalErrors).toBe(1);
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem("klinefelter-errors", "{nope");

    expect(getErrorLogs()).toEqual([]);
  });

  it("captures global errors once", () => {
    const spy = vi.spyOn(window, "addEventListener");

    installGlobalErrorHandlers();
    installGlobalErrorHandlers();

    expect(spy.mock.calls.filter(([name]) => name === "error")).toHaveLength(1);
    expect(spy.mock.calls.filter(([name]) => name === "unhandledrejection")).toHaveLength(1);

    window.dispatchEvent(new ErrorEvent("error", { message: "global boom" }));
    expect(getErrorLogs()[0].context).toBe("global:error");

    clearErrorLogs();
    spy.mockRestore();
  });
});
