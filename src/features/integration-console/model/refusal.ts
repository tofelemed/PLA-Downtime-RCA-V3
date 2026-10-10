import { StaleRevisionError, V2ApiError } from '@/api/v2/errors';

/**
 * A refused integration command as the server said it (plan 3.7): role refusals (403 — connections,
 * jobs, mappings, replay and quarantine need an integration administrator or manager approver), stale
 * edits (412), state conflicts (409), validation (422) and source failures (502 with the adapter code).
 */
export type RefusalKind = 'role' | 'stale' | 'state' | 'validation' | 'source' | 'unavailable' | 'other';

export interface Refusal {
  kind: RefusalKind;
  title: string;
  code: string;
  message: string;
  fieldErrors: string[];
  correlationId: string | null;
}

const TITLES: Record<RefusalKind, string> = {
  role: 'Your role does not allow this (integration administrator or manager approver needed)',
  stale: 'Changed by someone else — reload and try again',
  state: 'Not allowed in the current state',
  validation: 'Not accepted',
  source: 'The source refused or could not be reached',
  unavailable: 'Not available for this source type',
  other: 'Refused',
};

function kindOf(error: V2ApiError): RefusalKind {
  if (error instanceof StaleRevisionError || error.status === 412) return 'stale';
  if (error.status === 403) return 'role';
  if (error.code === 'ADAPTER_UNAVAILABLE' || error.code === 'SAMPLE_UNSUPPORTED') return 'unavailable';
  if (error.status === 502 || error.status === 503) return 'source';
  if (error.status === 409) return 'state';
  if (error.status === 422 || error.status === 400) return 'validation';
  return 'other';
}

export function refusalOf(error: unknown): Refusal | null {
  if (!error) return null;
  if (!(error instanceof V2ApiError)) {
    return { kind: 'other', title: 'Request failed', code: 'NETWORK', message: 'The request did not reach the server. Try again.', fieldErrors: [], correlationId: null };
  }
  const kind = kindOf(error);
  return {
    kind,
    title: TITLES[kind],
    code: error.code,
    message: error.message,
    fieldErrors: error.fieldErrors.map((entry) => `${entry.field}: ${entry.message}`),
    correlationId: error.correlationId,
  };
}
