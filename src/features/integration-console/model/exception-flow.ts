import type { IngestionErrorCode, IngestionExceptionDetailView, ReplayRunView } from '@/api/v2/types/integrations';

/** What each quarantine code means and the usual fix (ING05); the replay applies the fixed mapping. */
export const ERROR_CODE_INFO: Record<IngestionErrorCode, { label: string; suggestion: string }> = {
  unknown_unit: { label: 'Source not mapped to a unit', suggestion: 'Bind the source element (path or id) to a unit, then replay.' },
  unknown_template: { label: 'Unknown template', suggestion: 'Map the template in the attribute mapping editor, then replay.' },
  unknown_code: { label: 'Unknown reason / impact code', suggestion: 'Add the code to the code library or correct the source value, then replay.' },
  mapping_ambiguous: { label: 'Ambiguous mapping', suggestion: 'Two rules of equal precedence point at different targets: change a precedence, then replay.' },
  mapping_invalid_target: { label: 'Mapping points outside the plant', suggestion: 'Fix the rule target (unit or asset of this tenant), then replay.' },
  schema_invalid: { label: 'Record does not match the schema', suggestion: 'Correct the source or the adapter scope; replay or mark irrecoverable.' },
  unit_conflict: { label: 'Unit of measure conflict', suggestion: 'Align the signal unit with the source unit, then replay.' },
  duration_conflict: { label: 'Duration conflict', suggestion: 'Check the duration rule (unit or TimeSpan) in the mapping editor, then replay.' },
  order_conflict: { label: 'Out-of-order revision', suggestion: 'A newer revision exists; usually mark irrecoverable.' },
  no_handler: { label: 'No handler for this record kind', suggestion: 'Not processed by this release; mark irrecoverable with the reason.' },
  processing_failed: { label: 'Processing failed', suggestion: 'Retry with a replay; if it keeps failing, report the reference.' },
  unknown_signal: { label: 'Unknown signal', suggestion: 'Define the signal for this source key, then replay.' },
};

export const ERROR_CODES = Object.keys(ERROR_CODE_INFO) as IngestionErrorCode[];

export interface BindTarget {
  matchKind: 'exact_path' | 'exact_id';
  matchValue: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/**
 * The identifier to bind for an unmapped record: the source path the server recorded with the exception
 * (`detail.sourcePath`, PI: the element path), else the referenced element id from the raw payload.
 */
export function bindTargetOf(exception: IngestionExceptionDetailView): BindTarget | null {
  const path = asRecord(exception.detail)?.sourcePath;
  if (typeof path === 'string' && path.trim() !== '' && path !== exception.sourceObjectId) {
    return { matchKind: 'exact_path', matchValue: path };
  }
  const provenance = asRecord(asRecord(exception.raw?.payload)?.provenance);
  const frame = asRecord(asRecord(provenance?.rawPayload)?.frame);
  const element = asRecord(frame?.PrimaryReferencedElement);
  return typeof element?.WebId === 'string' ? { matchKind: 'exact_id', matchValue: element.WebId } : null;
}

/** UX06 resolution: dry run (counts) → confirm → replay (run) → done; or irrecoverable with a reason. */
export type Resolution =
  | { step: 'idle' }
  | { step: 'dry-run'; runId: string }
  | { step: 'replaying'; runId: string }
  | { step: 'closed' };

export type ResolutionEvent =
  | { type: 'dry-run-started'; runId: string }
  | { type: 'replay-started'; runId: string }
  | { type: 'closed' }
  | { type: 'reset' };

export function resolutionReducer(state: Resolution, event: ResolutionEvent): Resolution {
  switch (event.type) {
    case 'dry-run-started':
      return { step: 'dry-run', runId: event.runId };
    case 'replay-started':
      return { step: 'replaying', runId: event.runId };
    case 'closed':
      return { step: 'closed' };
    case 'reset':
      return state.step === 'idle' ? state : { step: 'idle' };
  }
}

const COUNT_ORDER = ['objects', 'normalized', 'quarantined', 'unchanged', 'failed'] as const;

/** Counts of a replay run in a fixed order, as the server reported them. */
export function replayCounts(run: Pick<ReplayRunView, 'counts'> | undefined): Array<[string, number]> {
  const counts = run?.counts ?? {};
  return COUNT_ORDER.filter((key) => typeof counts[key] === 'number').map((key) => [key, counts[key] as number]);
}

/** A real replay is offered only after a completed dry run that found something to replay. */
export function canReplayAfterDryRun(run: Pick<ReplayRunView, 'state' | 'dryRun' | 'counts'> | undefined): boolean {
  return Boolean(run && run.dryRun && run.state === 'completed' && (run.counts?.objects ?? 0) > 0);
}
