import { StaleRevisionError, V2ApiError } from '@/api/v2/errors';
import type { CodeReferencesView } from '@/api/v2/types/codes-admin';

/**
 * A refused code or rule command as the server said it (plan 3.8): role (403), tenant-wide grant
 * (403 TENANT_SCOPE_REQUIRED), separation of duties (403), read-only role, stale edit (412), state
 * conflict (409), validation (422).
 */
export type AdminRefusalKind = 'role' | 'tenant-scope' | 'duties' | 'stale' | 'state' | 'validation' | 'other';

export interface AdminRefusal {
  kind: AdminRefusalKind;
  status: number | null;
  title: string;
  code: string;
  message: string;
  fieldErrors: string[];
  correlationId: string | null;
  /** 409 CODE_HAS_CHILDREN: what still points at the code */
  references: CodeReferencesView | null;
}

const TITLES: Record<AdminRefusalKind, string> = {
  role: 'Your role does not allow this (master data administrator or manager approver needed)',
  'tenant-scope': 'A whole-plant grant is required (your access is limited to some units)',
  duties: 'Separation of duties: someone other than the author must do this',
  stale: 'Changed by someone else — reload and try again',
  state: 'Not allowed in the current state',
  validation: 'Not accepted',
  other: 'Refused',
};

/** 403 READ_ONLY_ROLE (WriteAccessGuard): every role held in this plant is read-only, e.g. `viewer`. */
const READ_ONLY_TITLE = 'Your role in this plant is read-only';

function kindOf(error: V2ApiError): AdminRefusalKind {
  if (error instanceof StaleRevisionError || error.status === 412) return 'stale';
  if (error.code === 'TENANT_SCOPE_REQUIRED') return 'tenant-scope';
  if (error.code === 'SEPARATION_OF_DUTIES') return 'duties';
  if (error.status === 403) return 'role';
  if (error.status === 409) return 'state';
  if (error.status === 422 || error.status === 400) return 'validation';
  return 'other';
}

function referencesOf(error: V2ApiError): CodeReferencesView | null {
  const value = error.details?.references;
  if (typeof value !== 'object' || value === null) return null;
  const counts = value as Record<string, unknown>;
  const number = (key: string) => (typeof counts[key] === 'number' ? (counts[key] as number) : 0);
  return { activeChildren: number('activeChildren'), events: number('events'), mappingRules: number('mappingRules') };
}

export function adminRefusalOf(error: unknown): AdminRefusal | null {
  if (!error) return null;
  if (!(error instanceof V2ApiError)) {
    return { kind: 'other', status: null, title: 'Request failed', code: 'NETWORK', message: 'The request did not reach the server. Try again.', fieldErrors: [], correlationId: null, references: null };
  }
  const kind = kindOf(error);
  return {
    kind,
    status: error.status,
    title: error.code === 'READ_ONLY_ROLE' ? READ_ONLY_TITLE : TITLES[kind],
    code: error.code,
    message: error.message,
    fieldErrors: error.fieldErrors.map((entry) => `${entry.field}: ${entry.message}`),
    correlationId: error.correlationId,
    references: referencesOf(error),
  };
}
