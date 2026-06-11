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

  it("sanitizes URLs and local paths from exported stacks", () => {
    const error = new Error("private stack");
    error.stack = [
      "Error: private stack",
      "    at run (https://example.com/klinefelter-game/assets/app.js:10:20)",
      "    at local (/home/eren/Desktop/code-projects/klinefelter-game/src/main.ts:5:1)",
      "    at win (C:\\Users\\Eren\\project\\src\\main.ts:6:2)",
    ].join("\n");

    logError(error, "sanitize-test");
    const exported = exportErrorLogs();

    expect(exported).not.toContain("example.com");
    expect(exported).not.toContain("/home/eren");
    expect(exported).not.toContain("C:\\Users");
    expect(exported).toContain("[URL]");
    expect(exported).toContain("[PATH]");
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
