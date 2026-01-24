/**
 * Structured Logger for BagsWorld
 *
 * Provides centralized logging with:
 * - Structured log format (JSON in production)
 * - Log levels (debug, info, warn, error)
 * - Context enrichment (request ID, user ID, etc.)
 * - External monitoring hooks (Sentry, DataDog, etc.)
 *
 * To integrate with external monitoring:
 * 1. Set SENTRY_DSN environment variable
 * 2. Or implement custom errorReporter in this file
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Environment checks
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

// Log level threshold (can be configured via env)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const configuredLevel = (process.env.LOG_LEVEL as LogLevel) || (isProduction ? "info" : "debug");

/**
 * External error reporter hook
 * Replace this with Sentry, DataDog, or your preferred service
 */
async function reportToExternalService(entry: LogEntry): Promise<void> {
  // TODO: Integrate with external monitoring service
  // Example Sentry integration:
  // if (process.env.SENTRY_DSN && entry.level === 'error') {
  //   Sentry.captureException(entry.error, { extra: entry.context });
  // }

  // For now, we just track error count in memory for health checks
  if (entry.level === "error") {
    errorCount++;
    lastError = entry;
  }
}

// Simple error tracking for health checks
let errorCount = 0;
let lastError: LogEntry | null = null;
const errorCountResetTime = Date.now();

/**
 * Get error stats for health checks
 */
export function getErrorStats(): {
  errorCount: number;
  lastError: LogEntry | null;
  uptime: number;
} {
  return {
    errorCount,
    lastError,
    uptime: Date.now() - errorCountResetTime,
  };
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  if (isProduction) {
    // JSON format for production (easier to parse by log aggregators)
    return JSON.stringify(entry);
  }

  // Human-readable format for development
  const { timestamp, level, message, context, error } = entry;
  const levelPadded = level.toUpperCase().padEnd(5);
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  const errorStr = error
    ? `\n  Error: ${error.message}${error.stack ? `\n  Stack: ${error.stack}` : ""}`
    : "";

  return `[${timestamp}] ${levelPadded} ${message}${contextStr}${errorStr}`;
}

/**
 * Check if log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel];
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return entry;
}

/**
 * Main logger class
 */
class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.log("error", message, context, err);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!shouldLog(level)) {
      return;
    }

    const mergedContext = { ...this.context, ...context };
    const entry = createLogEntry(level, message, mergedContext, error);
    const formatted = formatLogEntry(entry);

    // Output to console
    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }

    // Report to external service for errors and warnings
    if (level === "error" || level === "warn") {
      reportToExternalService(entry).catch(() => {
        // Silently fail - don't crash on monitoring failure
      });
    }
  }

  /**
   * Log API request completion
   */
  apiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    this.log(level, `${method} ${path} ${statusCode} ${duration}ms`, {
      ...context,
      statusCode,
      duration,
      endpoint: path,
    });
  }
}

// Default logger instance
export const logger = new Logger();

// Factory function for creating contextual loggers
export function createLogger(context: LogContext): Logger {
  return new Logger(context);
}

// Export the Logger class for typing
export { Logger };
