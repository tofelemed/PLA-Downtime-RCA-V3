import { StaleRevisionError, V2ApiError } from '@/api/v2/errors';
import type { LineRef } from './draft-lines';

/**
 * How the editor and the workflow bar present a refused command (plan 3.5): the server's code is kept and
 * shown; the kind decides the dialog — RUN_CHANGED → candidate diff + rebase, 412 → latest revision +
 * rebase, 422 issues → inline per line (with the server's remaining allocation), separation of duties,
 * stale submission ("inputs changed, recompute and resubmit"), gate failures as a list.
 */
export type WorkflowProblemKind =
  | 'run_changed'
  | 'stale_revision'
  | 'content_changed'
  | 'line_issues'
  | 'gates'
  | 'duties'
  | 'stale_submission'
  | 'role'
  | 'network'
  | 'other';

export interface WorkflowIssue {
  code: string;
  message: string;
  sliceId: string | null;
  line?: number;
  expectedRemainingAllocation?: string;
}

export interface CandidateDiff {
  currentRunId: string | null;
  added: string[];
  removed: string[];
  changed: Array<{ autoKey: string; before: string; after: string }>;
}

export interface WorkflowProblem {
  kind: WorkflowProblemKind;
  code: string;
  message: string;
  status: number | null;
  issues: WorkflowIssue[];
  diff: CandidateDiff | null;
  correlationId: string | null;
}

const LINE_CODES = new Set([
  'INVALID_LINE', 'REASON_REQUIRED', 'QUANTITY_REQUIRED', 'NEGATIVE_QUANTITY', 'UNKNOWN_CANDIDATE', 'KIND_REQUIRED',
  'SLICE_REQUIRED', 'EVIDENCE_REQUIRED', 'CODE_REQUIRED', 'INVALID_REFERENCE', 'CODE_COMBINATION_INVALID',
  'EVIDENCE_OUTSIDE_SEGMENT', 'ALLOCATION_EXCEEDED', 'DUPLICATE_DECISION', 'UNACCOUNTED_NOT_ALLOWED',
]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

export function issuesOf(error: V2ApiError): WorkflowIssue[] {
  const raw = error.details?.issues;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((entry) => ({
    code: String(entry.code ?? error.code),
    message: String(entry.message ?? ''),
    sliceId: typeof entry.sliceId === 'string' ? entry.sliceId : null,
    ...(typeof entry.line === 'number' ? { line: entry.line } : {}),
    ...(typeof entry.expectedRemainingAllocation === 'string' ? { expectedRemainingAllocation: entry.expectedRemainingAllocation } : {}),
  }));
}

export function diffOf(error: V2ApiError): CandidateDiff | null {
  const d = error.details;
  if (!d) return null;
  const changed = Array.isArray(d.changed)
    ? d.changed.filter(isRecord).map((c) => ({ autoKey: String(c.autoKey), before: String(c.before), after: String(c.after) }))
    : [];
  return { currentRunId: typeof d.currentRunId === 'string' ? d.currentRunId : null, added: strings(d.added), removed: strings(d.removed), changed };
}

function kindOf(error: V2ApiError, issues: WorkflowIssue[]): WorkflowProblemKind {
  if (error.code === 'RUN_CHANGED') return 'run_changed';
  if (error instanceof StaleRevisionError || error.status === 412) return 'stale_revision';
  if (error.code === 'CONTENT_CHANGED') return 'content_changed';
  if (error.code === 'SEPARATION_OF_DUTIES') return 'duties';
  if (error.code === 'STALE_SUBMISSION') return 'stale_submission';
  if (error.status === 403) return 'role';
  if (error.status === 422 && issues.some((i) => i.line !== undefined || LINE_CODES.has(i.code))) return 'line_issues';
  if (error.status === 422) return 'gates';
  return 'other';
}

/** The problem behind a failed workflow command, or null when nothing failed. */
export function workflowProblemOf(error: unknown): WorkflowProblem | null {
  if (!error) return null;
  if (!(error instanceof V2ApiError)) {
    return { kind: 'network', code: 'NETWORK', message: 'The request did not reach the server; nothing was saved. Try again.', status: null, issues: [], diff: null, correlationId: null };
  }
  const issues = issuesOf(error);
  const kind = kindOf(error, issues);
  return {
    kind,
    code: error.code,
    message: error.message,
    status: error.status,
    issues,
    diff: kind === 'run_changed' ? diffOf(error) : null,
    correlationId: error.correlationId,
  };
}

/** Issues of a draft save keyed by the editor row they belong to (`line` = index in the sent payload). */
export function issuesByRow(issues: readonly WorkflowIssue[], refs: readonly LineRef[]): Map<string, WorkflowIssue[]> {
  const rows = new Map<string, WorkflowIssue[]>();
  for (const issue of issues) {
    const ref = issue.line === undefined ? undefined : refs[issue.line];
    if (!ref) continue;
    const key = ref.type === 'decision' ? `decision:${ref.autoKey}` : `manual:${ref.uid}`;
    rows.set(key, [...(rows.get(key) ?? []), issue]);
  }
  return rows;
}
