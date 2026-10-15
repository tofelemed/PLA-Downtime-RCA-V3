/** Plain words for the actuals provenance of a period (backend `domain/actuals/period/*`). */
export const ACTUALS_METHOD_LABELS: Readonly<Record<string, string>> = {
  counter_delta: 'Counter readings',
  output_events: 'Output events',
  external_report: 'Daily production report',
  mixed: 'Several sources',
  manual: 'Manual entry',
};

export const ACTUALS_SOURCE_LABELS: Readonly<Record<string, string>> = {
  pi_counter: 'PI counter',
  pi_output_ef: 'PI output events',
  mqtt: 'MQTT',
  external_report: 'Daily production report',
  manual: 'Manual entry',
  counter: 'Counter',
};

export const SEGMENT_QUALITY_LABELS: Readonly<Record<string, string>> = {
  measured: 'measured',
  estimated: 'estimated',
  excluded: 'excluded',
  missing: 'missing',
};

export const ACTUALS_QUALITY_LABELS: Readonly<Record<string, string>> = {
  complete: 'Complete',
  incomplete: 'Incomplete',
  partial: 'Partly covered',
  missing: 'Missing',
  conflict: 'Sources disagree',
};

export const FINDING_LABELS: Readonly<Record<string, string>> = {
  ambiguous_signal: 'More than one signal could be the output',
  external_report_grain_mismatch: 'The daily report does not match the shift grain',
  fallback_used: 'A fallback source was used',
  mixed_uom: 'Sources use different units',
  negative_output: 'A source reported negative output',
  open_output_event: 'An output event is still open',
  proportional_estimate: 'Output estimated proportionally',
  rejects_not_measured: 'Rejects are not measured',
  source_conflict: 'Sources disagree',
  spanning_event: 'An output event spans several periods',
  uom_mismatch: 'Unit differs from the profile unit',
  coverage_gap: 'Part of the period has no data',
  rejects_from_dispositions: 'Rejects taken from the approved lot dispositions',
  dispositions_exceed_rejects: 'The lot dispositions classify more than the measured rejects',
  reprocessed_input_excluded: 'Reprocessed material measured again is not counted as new output',
  disposition_uom_mismatch: 'A lot disposition uses another unit than the profile',
};

const SPLIT_METHODS: Readonly<Record<string, string>> = {
  running_time: 'by running time',
  elapsed_time: 'by elapsed time',
};

/** A finding in words, with how an estimate was made when the server says so (SME Q18). */
export function findingText(finding: { code: string; detail?: Record<string, unknown> }): string {
  const label = FINDING_LABELS[finding.code] ?? finding.code;
  const method = typeof finding.detail?.method === 'string' ? SPLIT_METHODS[finding.detail.method] : undefined;
  return method ? `${label} (${method})` : label;
}

export const ADJUSTMENT_KIND_LABELS: Readonly<Record<string, string>> = {
  gross: 'Gross output',
  good: 'Good output',
  reject: 'Rejects',
  rework: 'Rework',
};

export const ADJUSTMENT_BASIS_LABELS: Readonly<Record<string, string>> = {
  measured: 'Measured',
  estimated: 'Estimated',
};

export const ADJUSTMENT_STATE_LABELS: Readonly<Record<string, string>> = {
  proposed: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  superseded: 'Superseded',
};
