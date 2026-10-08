import { PiSearchScope } from './pi-frame-search';
import { PiRequestError } from './pi-http-client';

/**
 * What a PI ingestion job does (PI03–PI06; one `ingestion_jobs` row each, several per tenant):
 * - `window` — the regular poll: `[checkpoint − overlap, now)`, every page, checkpoint per window;
 * - `open_frames` — re-reads every tracked open frame by WebId (T08);
 * - `rescan` — correction scan over the last `rescanDays` (7 daily, 90 weekly by default);
 * - `inventory` — compares the source's WebIds of the last `inventoryDays` with what intake knows and
 *   retracts confirmed deletions (T46).
 */
export const PI_JOB_MODES = [
  'window',
  'open_frames',
  'rescan',
  'inventory',
] as const;
export type PiJobMode = (typeof PI_JOB_MODES)[number];

export interface PiJobScope {
  mode: PiJobMode;
  /** null only for `open_frames` (the tracker is per connection) */
  search: PiSearchScope | null;
  lookbackMinutes: number;
  overlapMinutes: number;
  rescanDays: number;
  inventoryDays: number;
}

export const PI_SCOPE_DEFAULTS = {
  lookbackMinutes: 60,
  overlapMinutes: 15,
  rescanDays: 7,
  inventoryDays: 7,
} as const;

/** The typed scope of a job; a scope that names no AF database/element fails the job (not retried). */
export function parsePiJobScope(
  scope: Readonly<Record<string, unknown>>,
): PiJobScope {
  const mode = PI_JOB_MODES.find((candidate) => candidate === scope.mode);
  const resolved: PiJobMode = mode ?? 'window';
  if (scope.mode !== undefined && !mode) {
    throw invalid(`unknown PI job mode ${JSON.stringify(scope.mode)}`);
  }
  return {
    mode: resolved,
    search: resolved === 'open_frames' ? null : searchOf(scope),
    lookbackMinutes: positive(scope.lookbackMinutes, 'lookbackMinutes'),
    overlapMinutes: positive(scope.overlapMinutes, 'overlapMinutes'),
    rescanDays: positive(scope.rescanDays, 'rescanDays'),
    inventoryDays: positive(scope.inventoryDays, 'inventoryDays'),
  };
}

function searchOf(scope: Readonly<Record<string, unknown>>): PiSearchScope {
  const scopeType = scope.scopeType ?? 'database';
  if (scopeType !== 'database' && scopeType !== 'element') {
    throw invalid('scopeType must be database or element');
  }
  if (typeof scope.scopeId !== 'string' || scope.scopeId.length === 0) {
    throw invalid('scopeId (AF database or element WebId) is required');
  }
  const template = scope.templateName;
  return {
    scopeType,
    scopeId: scope.scopeId,
    templateName: typeof template === 'string' && template ? template : null,
  };
}

function positive(value: unknown, key: keyof typeof PI_SCOPE_DEFAULTS): number {
  if (value === undefined || value === null) return PI_SCOPE_DEFAULTS[key];
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw invalid(`${key} must be a positive number`);
  }
  return parsed;
}

function invalid(message: string): PiRequestError {
  return new PiRequestError(`Invalid PI job scope: ${message}`, 'rejected');
}
