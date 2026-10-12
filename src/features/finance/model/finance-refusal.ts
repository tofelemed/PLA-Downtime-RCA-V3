import { StaleRevisionError, V2ApiError } from '@/api/v2/errors';

/** What kind of refusal a finance command got (the alert's icon and the tests key on it). */
export type FinanceRefusalKind = 'role' | 'scope' | 'duties' | 'conflict' | 'stale' | 'state' | 'validation' | 'other';

/** One approved version a draft overlaps (409 VERSION_OVERLAP `details.conflicts`). */
export interface OverlapConflict {
  key: string;
  version: number | null;
  from: string | null;
  to: string | null;
}

const SCOPE_CODES = new Set(['TENANT_SCOPE_REQUIRED', 'SITE_SCOPE_REQUIRED', 'TENANT_NOT_ALLOWED']);

export function financeRefusalKind(error: unknown): FinanceRefusalKind {
  if (!(error instanceof V2ApiError)) return 'other';
  if (error instanceof StaleRevisionError || error.status === 412) return 'stale';
  if (error.code === 'SEPARATION_OF_DUTIES') return 'duties';
  if (SCOPE_CODES.has(error.code)) return 'scope';
  if (error.status === 403) return 'role';
  if (error.code === 'VERSION_OVERLAP') return 'conflict';
  if (error.status === 409) return 'state';
  if (error.status === 422 || error.status === 400) return 'validation';
  return 'other';
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** The approved versions a refused approval overlaps, as the server listed them. */
export function overlapConflicts(error: unknown): OverlapConflict[] {
  if (!(error instanceof V2ApiError)) return [];
  const raw = error.details?.conflicts;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry, index) => ({
      key: text(entry.id) ?? String(index),
      version: typeof entry.version === 'number' ? entry.version : null,
      from: text(entry.effectiveFrom),
      to: text(entry.effectiveTo),
    }));
}
