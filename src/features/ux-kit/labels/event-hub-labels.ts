/**
 * Labels of the Event Hub filters that are not DT11 states (those live in `event-labels.ts`): the v1
 * event families (the old Event Hub tabs, `eventType`) and the v1 severity values.
 */
export const EVENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  ProductionLoss: 'Production loss',
  IOW: 'Integrity operating window',
  SOL: 'Safe operating limit',
  APM: 'Asset performance alert',
  FailureWO: 'Failure work order',
  ProductionOutput: 'Production output',
};

/** SME D8: failure severity of a stop (ISO 14224); distinct from the event severity. */
export const FAILURE_SEVERITY_LABELS: Readonly<Record<string, string>> = {
  critical: 'Critical',
  degraded: 'Degraded',
  incipient: 'Incipient',
};

export const SEVERITY_LABELS: Readonly<Record<string, string>> = {
  Critical: 'Critical',
  High: 'High',
  Medium: 'Medium',
  Low: 'Low',
};
