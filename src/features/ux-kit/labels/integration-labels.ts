import type {
  DiagnosticStatus,
  ExceptionState,
  IngestionErrorCode,
  JobAction,
  JobState,
  ReplayState,
  SourceType,
} from '@/api/v2/types/integrations';

/**
 * Labels of the integration console (plan 3.7): sources, ingestion jobs, replay, quarantine. Wording
 * follows `integration-console/model/job-states.ts`.
 */
export const JOB_STATE_LABELS: Readonly<Record<JobState, string>> = {
  created: 'Created',
  running: 'Running',
  draining: 'Draining (stops when caught up)',
  paused: 'Paused',
  stopped: 'Stopped',
  failed: 'Failed',
};

export const JOB_ACTION_LABELS: Readonly<Record<JobAction, string>> = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  drain: 'Drain',
  stop: 'Stop',
};

export const SOURCE_TYPE_LABELS: Readonly<Record<SourceType, string>> = {
  pi_web_api: 'PI Web API',
  mqtt: 'MQTT',
  kafka: 'Kafka',
  opc_ua: 'OPC UA',
  rest_import: 'REST import',
  file_import: 'File import',
  db_import: 'Database import',
  manual: 'Manual entry',
};

export const DIAGNOSTIC_STATUS_LABELS: Readonly<Record<DiagnosticStatus, string>> = {
  ok: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
  not_applicable: 'Not applicable',
};

/** Connection / job failure kinds (job health). */
export const SOURCE_FAILURE_LABELS: Readonly<Record<string, string>> = {
  auth_failed: 'Authentication failed',
  authz_failed: 'Not authorized',
  not_found: 'Scope not found',
  unsupported: 'Not supported by the source',
  request_rejected: 'Request rejected',
  source_unavailable: 'Source unavailable',
  unreachable: 'Source unreachable',
  tls_failed: 'Secure connection (TLS) failed',
  response_too_large: 'Response too large',
};

export const INGESTION_ERROR_LABELS: Readonly<Record<IngestionErrorCode, string>> = {
  unknown_template: 'No matching event template',
  unknown_code: 'Unknown reason code',
  unknown_unit: 'Unknown unit',
  mapping_ambiguous: 'More than one mapping matches',
  mapping_invalid_target: 'Mapping points to a missing target',
  schema_invalid: 'Message does not have the expected shape',
  unit_conflict: 'Unit differs from the existing event',
  duration_conflict: 'Duration conflicts with the start and end',
  order_conflict: 'Arrived out of order',
  no_handler: 'No handler for this message type',
  processing_failed: 'Processing failed',
  unknown_signal: 'Unknown signal',
  topic_shape: 'Topic does not match the expected pattern',
  not_json: 'Message is not valid JSON',
  too_large: 'Message too large',
  unsupported_version: 'Unsupported message version',
  identity_mismatch: 'Source identity does not match',
  future_timestamp: 'Time stamp in the future',
  stale_timestamp: 'Time stamp too old',
  topic_not_allowed: 'Topic not allowed',
  unmapped_value: 'Value has no mapping',
};

export const EXCEPTION_STATE_LABELS: Readonly<Record<ExceptionState, string>> = {
  open: 'Open',
  resolved: 'Resolved',
  irrecoverable: 'Cannot be recovered',
};

export const REPLAY_STATE_LABELS: Readonly<Record<ReplayState, string>> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

/** Job kinds the console creates (the `purpose` kept in a job's scope). */
export const JOB_PURPOSE_LABELS: Readonly<Record<string, string>> = {
  limited: 'Limited ingestion',
  backfill: 'Bounded backfill',
  production: 'Production cadence',
  subscribe: 'Broker subscription',
};

/** PI job modes without a console purpose (upkeep and signal jobs, scope `mode`). */
export const JOB_MODE_LABELS: Readonly<Record<string, string>> = {
  open_frames: 'Open frames refresh',
  rescan: 'Correction rescan',
  inventory: 'Deletion check',
  recorded: 'Signal values',
  summary: 'Signal totals',
  updates: 'Signal updates',
  backfill: 'Signal backfill',
};

/** Outcome counters of a job's last page and of replay runs. */
export const INTAKE_OUTCOME_LABELS: Readonly<Record<string, string>> = {
  accepted: 'Accepted',
  created: 'Created',
  updated: 'Updated',
  duplicate: 'Duplicate',
  duplicates: 'Duplicates',
  stale: 'Stale',
  conflict: 'Conflict',
  quarantined: 'Quarantined',
  objects: 'Records',
  normalized: 'Processed',
  unchanged: 'Unchanged',
  failed: 'Failed',
  received: 'Received',
};

/** How a source mapping rule matches (resolution order). */
export const MATCH_KIND_LABELS: Readonly<Record<string, string>> = {
  exact_id: 'Exact id',
  exact_path: 'Exact path',
  pattern: 'Pattern',
  af_binding: 'AF element binding',
};

export const MAPPING_TARGET_LABELS: Readonly<Record<string, string>> = {
  unit: 'Unit',
  asset: 'Asset',
};

/** Result of resolving a sample against the mapping rules. */
export const MAPPING_STATUS_LABELS: Readonly<Record<string, string>> = {
  mapped: 'Mapped',
  ambiguous: 'Ambiguous (equal precedence, different targets)',
  invalid_target: 'Target outside this plant',
  unmapped: 'Not mapped',
};

export const SIGNAL_TYPE_LABELS: Readonly<Record<string, string>> = {
  rate: 'Rate',
  counter: 'Counter (totalizer)',
  state: 'State',
  quality: 'Quality',
  level: 'Level',
  output_increment: 'Output increments',
  other: 'Other',
};

export const SIGNAL_TIMEBASE_LABELS: Readonly<Record<string, string>> = {
  s: 'per second',
  min: 'per minute',
  h: 'per hour',
  d: 'per day',
};

export const INTERPOLATION_LABELS: Readonly<Record<string, string>> = {
  step: 'Step (hold last value)',
  linear: 'Linear',
};

export const RESET_POLICY_LABELS: Readonly<Record<string, string>> = {
  none: 'Never resets',
  known_instant: 'Resets at known instants',
  detect_drop: 'Detect resets from drops',
};

/** Sample quality of a stored signal value. */
export const SAMPLE_QUALITY_LABELS: Readonly<Record<string, string>> = {
  good: 'Good',
  uncertain: 'Uncertain',
  questionable: 'Questionable',
  substituted: 'Substituted',
  bad: 'Bad',
};

/** Quantity engines of the signal preview. */
export const SIGNAL_ENGINE_LABELS: Readonly<Record<string, string>> = {
  counter_delta: 'Counter difference',
  rate_integration: 'Rate integration',
  output_events: 'Output increments',
  none: 'No quantity for this signal type',
};
