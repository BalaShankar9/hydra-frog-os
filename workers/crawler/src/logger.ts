export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMeta {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: LogMeta;
}

function formatLog(level: LogLevel, message: string, meta?: LogMeta): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (meta && Object.keys(meta).length > 0) {
    entry.meta = meta;
  }

  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, meta?: LogMeta): void {
    console.log(formatLog('debug', message, meta));
  },

  info(message: string, meta?: LogMeta): void {
    console.log(formatLog('info', message, meta));
  },

  warn(message: string, meta?: LogMeta): void {
    console.warn(formatLog('warn', message, meta));
  },

  error(message: string, meta?: LogMeta): void {
    console.error(formatLog('error', message, meta));
  },

  log(level: LogLevel, message: string, meta?: LogMeta): void {
    const output = formatLog(level, message, meta);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  },
};
