import type { IngestionErrorCode, IngestionExceptionDetailView, IngestionExceptionView, ReplayRunView } from '@/api/v2/types/integrations';

/** What each quarantine code means and the usual fix (ING05); the replay applies the fixed mapping. */
export const ERROR_CODE_INFO: Record<IngestionErrorCode, { label: string; suggestion: string }> = {
  unknown_unit: {
    label: 'Source not mapped to a unit',
    suggestion:
      'Bind the source element to a unit ("Bind source to a unit" below, or the connection → Discovery and mapping → Sample records → Bind element), or add a rule under Connectivity → Source mappings; then replay this record. If the element is not accounted in Pro-Act, mark it irrecoverable.',
  },
  unknown_template: { label: 'Unknown template', suggestion: 'Map the template in the attribute mapping editor, then replay.' },
  unknown_code: {
    label: 'Unknown reason / impact code',
    suggestion:
      'The event was created uncoded. Add the code to the code library (later records are coded automatically) or correct the source value, then code this event in the Event Hub; a replay re-checks the record but never changes the codes of an existing event.',
  },
  mapping_ambiguous: { label: 'Ambiguous mapping', suggestion: 'Two rules of equal precedence point at different targets: change a precedence, then replay.' },
  mapping_invalid_target: { label: 'Mapping points outside the plant', suggestion: 'Fix the rule target (unit or asset of this tenant), then replay.' },
  schema_invalid: { label: 'Record does not match the schema', suggestion: 'Correct the source or the adapter scope; replay or mark irrecoverable.' },
  unit_conflict: { label: 'Unit of measure conflict', suggestion: 'Align the signal unit with the source unit, then replay.' },
  duration_conflict: { label: 'Duration conflict', suggestion: 'Check the duration rule (unit or TimeSpan) in the mapping editor, then replay.' },
  order_conflict: { label: 'Out-of-order revision', suggestion: 'A newer revision exists; usually mark irrecoverable.' },
  no_handler: { label: 'No handler for this record kind', suggestion: 'Not processed by this release; mark irrecoverable with the reason.' },
  processing_failed: { label: 'Processing failed', suggestion: 'Retry with a replay; if it keeps failing, report the reference.' },
  unknown_signal: { label: 'Unknown signal', suggestion: 'Define the signal for this source key, then replay.' },
  // MQTT decode rejections (plan 1.8): the source object is the topic; the raw payload reference is in the detail
  topic_shape: { label: 'Topic does not match the template', suggestion: 'Fix the topic template or the topic filters of the connection; the message is not replayable.' },
  not_json: { label: 'Payload is not a JSON object', suggestion: 'The gateway published something else (bytes, text, array); fix the publisher, mark irrecoverable.' },
  too_large: { label: 'Payload too large', suggestion: 'Raise maxMessageBytes on the connection or trim the message at the gateway; mark irrecoverable.' },
  unsupported_version: { label: 'Unsupported message version', suggestion: 'The message declares a contract version this profile does not decode; align the gateway or the profile.' },
  identity_mismatch: { label: 'Identity mismatch', suggestion: 'The ids in the message disagree with the topic (event id, gateway boot and sequence number); check the gateway.' },
  future_timestamp: { label: 'Timestamp in the future', suggestion: 'Beyond maxFutureSkewSeconds: fix the gateway clock (NTP) or the profile time settings; mark irrecoverable.' },
  stale_timestamp: { label: 'Timestamp too old', suggestion: 'Older than maxPastSeconds: raise the window on the profile if the data is wanted, then the gateway must re-publish.' },
  topic_not_allowed: { label: 'Topic outside the filters', suggestion: 'The broker delivered a topic the connection does not allow; narrow the broker ACL or the subscription.' },
  unmapped_value: { label: 'Unmapped state / reason token', suggestion: 'Add the raw token to the value map on the Payload profile tab (no silent default), then replay.' },
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

/** What the source sent, as recorded with the exception: the frame name, element path and offending value. */
export function exceptionFacts(exception: IngestionExceptionView & Partial<Pick<IngestionExceptionDetailView, 'raw'>>): Array<{ label: string; value: string }> {
  const detail = asRecord(exception.detail);
  const provenance = asRecord(asRecord(exception.raw?.payload)?.provenance);
  const frame = asRecord(asRecord(provenance?.rawPayload)?.frame);
  const facts: Array<{ label: string; value: string }> = [];
  if (typeof frame?.Name === 'string') facts.push({ label: 'Source record', value: frame.Name });
  if (typeof detail?.sourcePath === 'string' && detail.sourcePath !== exception.sourceObjectId) facts.push({ label: 'Element path', value: detail.sourcePath });
  const delivered = detail?.delivered;
  const token = typeof delivered === 'string' ? delivered : asRecord(delivered)?.Name;
  if (typeof token === 'string') facts.push({ label: 'Delivered value', value: token });
  return facts;
}

/** One line for the quarantine list: element path and delivered value, or a dash. */
export const exceptionSummary = (exception: IngestionExceptionView): string =>
  exceptionFacts(exception).map((fact) => fact.value).join(' · ') || '—';

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
