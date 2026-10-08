import { PiRequestError } from './pi-http-client';

/**
 * PI signal job modes (plan 1.7, PI07/PI08; one `ingestion_jobs` row each, next to the 1.6 frame modes):
 * - `recorded` — recorded values of the connection's signals via `streamsets/recorded`, paged, with an
 *   overlap that re-reads recent values (late archive corrections become new revisions);
 * - `summary`  — PI `Total` (TimeWeighted) per interval, rate signals only, timebase confirmed (PI09);
 * - `updates`  — stream updates (markers) where PI supports them; a lost marker re-registers and
 *   backfills a bounded window (PI08);
 * - `backfill` — a fixed window `[from, to)` of a backfill run (drains, then stops).
 */
export const PI_SIGNAL_MODES = [
  'recorded',
  'summary',
  'updates',
  'backfill',
] as const;
export type PiSignalMode = (typeof PI_SIGNAL_MODES)[number];
export type RateTimebase = 's' | 'min' | 'h' | 'd';

export interface PiSignalScope {
  mode: PiSignalMode;
  /** empty = every current signal of the connection */
  signalIds: string[];
  lookbackMinutes: number;
  overlapMinutes: number;
  /** summary: interval length and the timebase PI assumes for the total of these tags */
  summaryMinutes: number;
  totalTimebase: RateTimebase | null;
  /** updates: longest window re-read after a lost marker */
  maxBackfillMinutes: number;
  /** backfill */
  from: string | null;
  to: string | null;
  runId: string | null;
}

export const PI_SIGNAL_DEFAULTS = {
  lookbackMinutes: 60,
  overlapMinutes: 15,
  summaryMinutes: 60,
  maxBackfillMinutes: 24 * 60,
} as const;

const TIMEBASES: readonly RateTimebase[] = ['s', 'min', 'h', 'd'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPiSignalMode(mode: unknown): mode is PiSignalMode {
  return (PI_SIGNAL_MODES as readonly unknown[]).includes(mode);
}

/** The typed scope of a signal job; problems are non-retryable (`rejected`). */
export function parsePiSignalScope(
  scope: Readonly<Record<string, unknown>>,
): PiSignalScope {
  if (!isPiSignalMode(scope.mode))
    throw invalid(`unknown mode ${String(scope.mode)}`);
  const parsed: PiSignalScope = {
    mode: scope.mode,
    signalIds: idsOf(scope.signalIds),
    lookbackMinutes: positive(scope, 'lookbackMinutes'),
    overlapMinutes: positive(scope, 'overlapMinutes'),
    summaryMinutes: positive(scope, 'summaryMinutes'),
    totalTimebase: timebaseOf(scope.totalTimebase),
    maxBackfillMinutes: positive(scope, 'maxBackfillMinutes'),
    from: isoOf(scope.from),
    to: isoOf(scope.to),
    runId: typeof scope.runId === 'string' ? scope.runId : null,
  };
  if (
    parsed.mode === 'backfill' &&
    (!parsed.from || !parsed.to || parsed.signalIds.length === 0)
  ) {
    throw invalid('backfill needs signalIds, from and to');
  }
  if (parsed.mode === 'summary' && !parsed.totalTimebase) {
    throw invalid(
      'summary needs totalTimebase (the timebase PI assumes for Total: s, min, h or d)',
    );
  }
  return parsed;
}

function idsOf(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (
    !Array.isArray(value) ||
    value.some((id) => typeof id !== 'string' || !UUID.test(id))
  ) {
    throw invalid('signalIds must be an array of signal ids (UUIDs)');
  }
  return value as string[];
}

function positive(
  scope: Readonly<Record<string, unknown>>,
  key: keyof typeof PI_SIGNAL_DEFAULTS,
): number {
  const value = scope[key];
  if (value === undefined || value === null) return PI_SIGNAL_DEFAULTS[key];
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw invalid(`${key} must be a positive number`);
  return parsed;
}

function timebaseOf(value: unknown): RateTimebase | null {
  if (value === undefined || value === null) return null;
  const found = TIMEBASES.find((timebase) => timebase === value);
  if (!found) throw invalid('totalTimebase must be s, min, h or d');
  return found;
}

function isoOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export function invalid(message: string): PiRequestError {
  return new PiRequestError(
    `Invalid PI signal job scope: ${message}`,
    'rejected',
  );
}
