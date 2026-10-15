/**
 * Frontend logger (CLAUDE.md: no `console.log` in product code). Debug output only in development;
 * warnings and errors always. Callers must never pass tokens or credentials — log ids and codes only.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const isDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV ?? false;

function write(level: Level, scope: string, message: string, detail?: unknown): void {
  if (!isDev && (level === 'debug' || level === 'info')) return;
  const line = `[${scope}] ${message}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.debug;
  if (detail === undefined) sink(line);
  else sink(line, detail);
}

export interface Logger {
  debug(message: string, detail?: unknown): void;
  info(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
  error(message: string, detail?: unknown): void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, detail) => write('debug', scope, message, detail),
    info: (message, detail) => write('info', scope, message, detail),
    warn: (message, detail) => write('warn', scope, message, detail),
    error: (message, detail) => write('error', scope, message, detail),
  };
}
