import { ProductionEvent } from '../../production-event/production-event.entity';

/** SME D8: severity of a failure finding; `critical` and `degraded` are functional failures (MTBF). */
export const FAILURE_SEVERITIES = [
  'critical',
  'degraded',
  'incipient',
] as const;

export interface FailureDetailBody {
  failureMode?: string | null;
  failureSeverity?: (typeof FAILURE_SEVERITIES)[number] | null;
  maintainableItem?: string | null;
  failureMechanism?: string | null;
  failureCause?: string | null;
  detectionMethod?: string | null;
}

const text = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() || null;

/** Failure-detail columns of a body (SME D11): trimmed, empty → null, absent → untouched. */
export function failureColumns(
  body: FailureDetailBody,
): Record<string, string | null | undefined> {
  const columns: Record<keyof FailureColumns, string | null | undefined> = {
    failureMode: text(body.failureMode),
    failureSeverity: body.failureSeverity,
    maintainableItem: text(body.maintainableItem),
    failureMechanism: text(body.failureMechanism),
    failureCause: text(body.failureCause),
    detectionMethod: text(body.detectionMethod),
  };
  return columns;
}

type FailureColumns = Pick<
  ProductionEvent,
  | 'failureMode'
  | 'failureSeverity'
  | 'maintainableItem'
  | 'failureMechanism'
  | 'failureCause'
  | 'detectionMethod'
>;
