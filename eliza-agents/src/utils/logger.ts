// Shared Logger Utility
// Consistent logging across all ElizaOS modules

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL as LogLevel];
}

export function createLogger(prefix: string) {
  const tag = `[${prefix}]`;
  return {
    debug: (msg: string, ...args: unknown[]) => {
      if (shouldLog('debug')) console.log(`${tag}:DEBUG ${msg}`, ...args);
    },
    info: (msg: string, ...args: unknown[]) => {
      if (shouldLog('info')) console.log(`${tag} ${msg}`, ...args);
    },
    warn: (msg: string, ...args: unknown[]) => {
      if (shouldLog('warn')) console.warn(`${tag} ${msg}`, ...args);
    },
    error: (msg: string, ...args: unknown[]) => {
      if (shouldLog('error')) console.error(`${tag} ${msg}`, ...args);
    },
  };
}

export default createLogger;
