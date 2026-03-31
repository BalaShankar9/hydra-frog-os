/**
 * Shared structured logger with correlation ID support.
 * Outputs JSON lines for log aggregation (ELK, CloudWatch, Datadog).
 */

export interface LogMeta {
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export function createLogger(service: string) {
  function log(level: LogLevel, message: string, meta?: LogMeta): void {
    if (!shouldLog(level)) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      ...meta,
    };

    const line = JSON.stringify(entry);

    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  return {
    debug: (message: string, meta?: LogMeta) => log('debug', message, meta),
    info: (message: string, meta?: LogMeta) => log('info', message, meta),
    warn: (message: string, meta?: LogMeta) => log('warn', message, meta),
    error: (message: string, meta?: LogMeta) => log('error', message, meta),
    child: (defaultMeta: LogMeta) => {
      return {
        debug: (message: string, meta?: LogMeta) => log('debug', message, { ...defaultMeta, ...meta }),
        info: (message: string, meta?: LogMeta) => log('info', message, { ...defaultMeta, ...meta }),
        warn: (message: string, meta?: LogMeta) => log('warn', message, { ...defaultMeta, ...meta }),
        error: (message: string, meta?: LogMeta) => log('error', message, { ...defaultMeta, ...meta }),
      };
    },
  };
}
