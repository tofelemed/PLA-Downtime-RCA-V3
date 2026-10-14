import type { ProductionEventView } from '@/api/v2/types/events';

/** SME D8 / D11: the failure-detail inputs of the event form (ISO 14224-aligned, free text for now). */
export const FAILURE_FIELDS = ['failureMode', 'failureSeverity', 'maintainableItem', 'failureMechanism', 'failureCause', 'detectionMethod'] as const;
export type FailureField = (typeof FAILURE_FIELDS)[number];
export type FailureValues = Record<FailureField, string>;

export const EMPTY_FAILURE: FailureValues = {
  failureMode: '',
  failureSeverity: '',
  maintainableItem: '',
  failureMechanism: '',
  failureCause: '',
  detectionMethod: '',
};

export function failureValuesOf(event: ProductionEventView): FailureValues {
  const failure = event.failure;
  return {
    failureMode: failure?.mode ?? '',
    failureSeverity: failure?.severity ?? '',
    maintainableItem: failure?.maintainableItem ?? '',
    failureMechanism: failure?.mechanism ?? '',
    failureCause: failure?.cause ?? '',
    detectionMethod: failure?.detectionMethod ?? '',
  };
}

/** The filled failure fields of a create body (trimmed). */
export function failureCreateFields(values: FailureValues): Partial<Record<FailureField, string>> {
  const body: Partial<Record<FailureField, string>> = {};
  for (const field of FAILURE_FIELDS) {
    const value = values[field].trim();
    if (value) body[field] = value;
  }
  return body;
}

/** The changed failure fields of a PATCH body; an emptied field is cleared with null. */
export function failurePatchFields(initial: FailureValues, values: FailureValues): Partial<Record<FailureField, string | null>> {
  const changes: Partial<Record<FailureField, string | null>> = {};
  for (const field of FAILURE_FIELDS) {
    if (values[field] !== initial[field]) changes[field] = values[field].trim() || null;
  }
  return changes;
}
