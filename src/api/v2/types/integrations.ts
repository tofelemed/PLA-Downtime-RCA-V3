/**
 * Integration console views (plan 3.7), mirrored by hand from the backend view files
 * (`src/v2/intake/intake-v2.view.ts`, `src/intake/adapters/adapter.interface.ts`,
 * `src/v2/source-mappings/source-mapping-v2.view.ts`, `src/v2/attribute-mappings/*`,
 * `src/v2/signals/signal-v2.view.ts`) — the OpenAPI snapshot documents no response bodies.
 */
export type SourceType = 'pi_web_api' | 'mqtt' | 'kafka' | 'opc_ua' | 'rest_import' | 'file_import' | 'db_import' | 'manual';

export interface ConnectionCapabilities {
  replay?: boolean;
  corrections?: boolean;
  deletions?: boolean;
  quality?: boolean;
  sourceTimestamps?: boolean;
  sequence?: boolean;
  batch?: boolean;
  streamUpdates?: boolean;
}

/** Connection without its secret: only whether one is stored (`hasSecret`). */
export interface ConnectionView {
  id: string;
  sourceType: SourceType;
  displayName: string;
  endpointConfig: Record<string, unknown>;
  hasSecret: boolean;
  /** MQTT: the client id the subscriber runs with (configured, or `proact-<id>`); null for other sources */
  effectiveClientId: string | null;
  capabilities: ConnectionCapabilities;
  configVersion: number;
  isActive: boolean;
  rowVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export type DiagnosticStatus = 'ok' | 'failed' | 'skipped' | 'not_applicable';

export interface DiagnosticCheck {
  status: DiagnosticStatus;
  detail?: string;
}

/** POST /connections/{id}/test (PI01 per step: dns, tls, auth, version, authz, read). */
export interface ConnectionTestView {
  connected: boolean;
  message: string;
  diagnostics?: Record<string, DiagnosticCheck>;
  capabilities?: Record<string, unknown>;
}

export interface AssetDatabaseView {
  name: string;
  webId: string;
}

export interface AssetServerView {
  name: string;
  webId: string;
  databases: AssetDatabaseView[];
}

/** GET /connections/{id}/discover (PI: asset servers and their AF databases). */
export interface DiscoveryView {
  capabilities: ConnectionCapabilities;
  metadata: { assetServers?: AssetServerView[] } & Record<string, unknown>;
}

export interface SampleRecordView {
  sourceObjectId: string;
  name: string | null;
  templateName: string | null;
  startTime: string;
  endTime: string | null;
  element: { webId: string | null; path: string | null } | null;
  attributes: Record<string, unknown>;
}

/** GET /connections/{id}/sample. */
export interface SourceSampleView {
  records: SampleRecordView[];
  templates: Array<{ name: string; records: number }>;
  truncated: boolean;
}

export type JobState = 'created' | 'running' | 'paused' | 'draining' | 'stopped' | 'failed';
export type JobAction = 'start' | 'pause' | 'resume' | 'drain' | 'stop';

export interface JobCadence {
  intervalSeconds: number;
  pageSize?: number;
}

export interface IngestionJobView {
  id: string;
  connectionId: string;
  scope: Record<string, unknown>;
  state: JobState;
  leaseOwner: string | null;
  leaseExpiry: string | null;
  heartbeatAt: string | null;
  committedCursor: Record<string, unknown> | null;
  lastObservationAt: string | null;
  lastSuccessAt: string | null;
  retryCount: number;
  lastError: string | null;
  cadence: JobCadence | null;
  nextRunAt: string | null;
  /** counts of the last page by outcome, or a failure code such as `{ auth_failed: 1 }` */
  health: Record<string, number>;
  rowVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface JobTransitionView {
  id: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  actorId: string | null;
  runner: string | null;
  detail: Record<string, unknown> | null;
  at: string | null;
}

export type IngestionErrorCode =
  | 'unknown_template'
  | 'unknown_code'
  | 'unknown_unit'
  | 'mapping_ambiguous'
  | 'mapping_invalid_target'
  | 'schema_invalid'
  | 'unit_conflict'
  | 'duration_conflict'
  | 'order_conflict'
  | 'no_handler'
  | 'processing_failed'
  | 'unknown_signal'
  // MQTT decode rejections (plan 1.8 design §4.2)
  | 'topic_shape'
  | 'not_json'
  | 'too_large'
  | 'unsupported_version'
  | 'identity_mismatch'
  | 'future_timestamp'
  | 'stale_timestamp'
  | 'topic_not_allowed'
  | 'unmapped_value';

export type ExceptionState = 'open' | 'resolved' | 'irrecoverable';

export interface IngestionExceptionView {
  id: string;
  connectionId: string;
  sourceObjectId: string;
  rawId: string;
  errorCode: IngestionErrorCode;
  detail: Record<string, unknown> | null;
  state: ExceptionState;
  ownerId: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  occurrences: number;
  resolution: Record<string, unknown> | null;
  replayRunId: string | null;
  rowVersion: number;
}

export interface IngestionExceptionDetailView extends IngestionExceptionView {
  raw: {
    id: string;
    receivedAt: string | null;
    messageId: string | null;
    outcome: string | null;
    /** false for roles that may not see source payloads (payload is then null) */
    payloadVisible: boolean;
    payload: unknown;
    payloadRef: string | null;
  } | null;
}

export type ReplayState = 'queued' | 'running' | 'completed' | 'failed';

export interface ReplayRunView {
  id: string;
  connectionId: string;
  from: string | null;
  to: string | null;
  scopes: Record<string, unknown> | null;
  reason: string;
  dryRun: boolean;
  state: ReplayState;
  /** objects, normalized, quarantined, unchanged, failed */
  counts: Record<string, number> | null;
  requestedBy: string | null;
  lastError: string | null;
  createdAt: string | null;
  finishedAt: string | null;
}
