type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogFields {
  traceId?: string;
  message: string;
  method?: string;
  path?: string;
  statusCode?: number;
  [key: string]: unknown;
}

/**
 * Minimal structured JSON logger.
 * Every line is a single JSON object: { timestamp, traceId, level, message, ...extra }
 */
function emit(level: LogLevel, fields: LogFields): void {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    ...fields,
  };

  const serialized = JSON.stringify(line);
  if (level === 'error') {
    process.stderr.write(serialized + '\n');
  } else {
    process.stdout.write(serialized + '\n');
  }
}

export const logger = {
  info: (message: string, fields: Partial<LogFields> = {}) =>
    emit('info', { message, ...fields }),
  warn: (message: string, fields: Partial<LogFields> = {}) =>
    emit('warn', { message, ...fields }),
  error: (message: string, fields: Partial<LogFields> = {}) =>
    emit('error', { message, ...fields }),
  debug: (message: string, fields: Partial<LogFields> = {}) =>
    emit('debug', { message, ...fields }),
};
