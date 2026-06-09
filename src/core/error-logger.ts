/**
 * Error Logger - Track and report errors for debugging.
 *
 * Logs errors to localStorage with context (timestamp, stack, browser info).
 * Provides export functionality for bug reports.
 */

const STORAGE_KEY = "klinefelter-errors";
const MAX_ERRORS = 50;

export interface ErrorLog {
  timestamp: number;
  message: string;
  stack?: string;
  context?: string;
  browserInfo: {
    userAgent: string;
    platform: string;
    language: string;
  };
}

/** Log an error with context */
export function logError(error: Error | string, context?: string): void {
  try {
    const errorLog: ErrorLog = {
      timestamp: Date.now(),
      message: typeof error === "string" ? error : error.message,
      stack: typeof error === "object" ? error.stack : undefined,
      context,
      browserInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      },
    };

    const logs = getErrorLogs();
    logs.unshift(errorLog);

    // Keep only last MAX_ERRORS
    if (logs.length > MAX_ERRORS) {
      logs.length = MAX_ERRORS;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (storageError) {
    // Can't log to localStorage - fail silently
    console.error("Failed to log error:", storageError);
  }
}

/** Get all error logs */
export function getErrorLogs(): ErrorLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Clear all error logs */
export function clearErrorLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/** Export error logs as JSON string */
export function exportErrorLogs(): string {
  const logs = getErrorLogs();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      totalErrors: logs.length,
      errors: logs,
    },
    null,
    2
  );
}

/** Get error count */
export function getErrorCount(): number {
  return getErrorLogs().length;
}

/** Wrap a function with error logging */
export function withErrorLogging<T extends (...args: any[]) => any>(
  fn: T,
  context: string
): T {
  return ((...args: any[]) => {
    try {
      return fn(...args);
    } catch (error) {
      logError(error as Error, context);
      throw error;
    }
  }) as T;
}
