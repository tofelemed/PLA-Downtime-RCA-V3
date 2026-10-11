import { StaleRevisionError, V2ApiError } from '@/api/v2/errors';

/**
 * What the server refused and why (plan 3.4): role and separation-of-duties refusals (403), version /
 * plan overlaps with the conflicting versions (409), stale edits (412), field errors (422). The screens
 * show them as they are — a refusal is never hidden or turned into a disabled button guess.
 */
export type RefusalKind = 'role' | 'scope' | 'duties' | 'conflict' | 'stale' | 'state' | 'validation' | 'other';

export interface ConflictLine {
  id: string | null;
  label: string;
  from: string | null;
  to: string | null;
}

export interface Refusal {
  kind: RefusalKind;
  title: string;
  code: string;
  message: string;
  status: number | null;
  fieldErrors: Record<string, string>;
  conflicts: ConflictLine[];
  correlationId: string | null;
}

const ROLE_CODES = new Set(['FORBIDDEN_ROLE', 'READ_ONLY_ROLE', 'FORBIDDEN']);
const SCOPE_CODES = new Set(['TENANT_SCOPE_REQUIRED', 'SITE_SCOPE_REQUIRED', 'TENANT_NOT_ALLOWED']);
const STATE_CODES = new Set(['VERSION_NOT_DRAFT', 'INVALID_TRANSITION', 'DRAFT_EXISTS', 'PERIODS_NOT_GENERATED', 'CALENDAR_PUBLISHED']);

const TITLES: Record<RefusalKind, string> = {
  role: 'Your role does not allow this',
  scope: 'Needs a wider scope',
  duties: 'Separation of duties',
  conflict: 'Overlaps an approved version',
  stale: 'Changed by someone else',
  state: 'Not allowed in this state',
  validation: 'Not accepted',
  other: 'Refused',
};

/** 403 READ_ONLY_ROLE (WriteAccessGuard): every role held in this plant is read-only, e.g. `viewer`. */
const READ_ONLY_TITLE = 'Your role in this plant is read-only';

function kindOf(error: V2ApiError): RefusalKind {
  if (error instanceof StaleRevisionError || error.status === 412) return 'stale';
  if (error.code === 'SEPARATION_OF_DUTIES') return 'duties';
  if (SCOPE_CODES.has(error.code)) return 'scope';
  if (ROLE_CODES.has(error.code) || error.status === 403) return 'role';
  if (error.code === 'VERSION_OVERLAP' || error.code === 'PLAN_OVERLAP') return 'conflict';
  if (STATE_CODES.has(error.code) || error.status === 409) return 'state';
  if (error.status === 422 || error.status === 400) return 'validation';
  return 'other';
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** `details.conflicts` of VERSION_OVERLAP (`version`, `effectiveFrom/To`) or PLAN_OVERLAP (`planId`, `activeFrom/To`). */
export function conflictsOf(error: V2ApiError): ConflictLine[] {
  const raw = error.details?.conflicts;
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null).map((entry) => {
    const plan = text(entry.planId);
    const label = plan ? `Plan ${plan.slice(0, 8)} v${String(entry.version)}` : `Version ${String(entry.version)}`;
    return {
      id: text(entry.id) ?? plan,
      label,
      from: text(entry.effectiveFrom) ?? text(entry.activeFrom),
      to: text(entry.effectiveTo) ?? text(entry.activeTo),
    };
  });
}

/** The refusal behind a failed command, or null when nothing failed. */
export function refusalOf(error: unknown): Refusal | null {
  if (!error) return null;
  if (!(error instanceof V2ApiError)) {
    return { kind: 'other', title: 'Request failed', code: 'NETWORK', message: 'The request did not reach the server. Try again.', status: null, fieldErrors: {}, conflicts: [], correlationId: null };
  }
  const kind = kindOf(error);
  return {
    kind,
    title: error.code === 'READ_ONLY_ROLE' ? READ_ONLY_TITLE : TITLES[kind],
    code: error.code,
    message: error.message,
    status: error.status,
    fieldErrors: error.fieldErrorMap(),
    conflicts: conflictsOf(error),
    correlationId: error.correlationId,
  };
}
