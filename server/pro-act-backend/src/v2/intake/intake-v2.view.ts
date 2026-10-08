import { IngestionException } from '../../intake/entities/ingestion-exception.entity';
import { IngestionJobTransition } from '../../intake/entities/ingestion-job-transition.entity';
import { IngestionJob } from '../../intake/entities/ingestion-job.entity';
import { IntegrationConnection } from '../../intake/entities/integration-connection.entity';
import { RawObservation } from '../../intake/entities/raw-observation.entity';
import { ReplayRun } from '../../intake/entities/replay-run.entity';

const iso = (value: Date | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null;

/** Connection without its secret (only whether one is stored). */
export function toConnectionView(connection: IntegrationConnection) {
  return {
    id: connection.id,
    sourceType: connection.sourceType,
    displayName: connection.displayName,
    endpointConfig: connection.endpointConfig,
    hasSecret: connection.secretRef !== null,
    capabilities: connection.capabilities,
    configVersion: connection.configVersion,
    isActive: connection.isActive,
    rowVersion: connection.rowVersion,
    createdAt: iso(connection.createdAt),
    updatedAt: iso(connection.updatedAt),
  };
}
export type ConnectionV2View = ReturnType<typeof toConnectionView>;

export function toJobView(job: IngestionJob) {
  return {
    id: job.id,
    connectionId: job.connectionId,
    scope: job.scope,
    state: job.state,
    leaseOwner: job.leaseOwner,
    leaseExpiry: iso(job.leaseExpiry),
    heartbeatAt: iso(job.heartbeatAt),
    committedCursor: job.committedCursor,
    lastObservationAt: iso(job.lastObservationAt),
    lastSuccessAt: iso(job.lastSuccessAt),
    retryCount: job.retryCount,
    lastError: job.lastError,
    cadence: job.cadence,
    nextRunAt: iso(job.nextRunAt),
    health: job.health,
    rowVersion: job.rowVersion,
    createdAt: iso(job.createdAt),
    updatedAt: iso(job.updatedAt),
  };
}
export type IngestionJobV2View = ReturnType<typeof toJobView>;

export function toTransitionView(row: IngestionJobTransition) {
  return {
    id: row.id,
    action: row.action,
    fromState: row.fromState,
    toState: row.toState,
    actorId: row.actorId,
    runner: row.runner,
    detail: row.detail,
    at: iso(row.createdAt),
  };
}
export type JobTransitionV2View = ReturnType<typeof toTransitionView>;

export function toExceptionView(row: IngestionException) {
  return {
    id: row.id,
    connectionId: row.connectionId,
    sourceObjectId: row.sourceObjectId,
    rawId: row.rawId,
    errorCode: row.errorCode,
    detail: row.detail,
    state: row.state,
    ownerId: row.ownerId,
    firstSeen: iso(row.firstSeen),
    lastSeen: iso(row.lastSeen),
    occurrences: row.occurrences,
    resolution: row.resolution,
    replayRunId: row.replayRunId,
    rowVersion: row.rowVersion,
  };
}
export type IngestionExceptionV2View = ReturnType<typeof toExceptionView>;

/** Exception detail with the retained raw delivery it points at (ING05 preview). */
export function toExceptionDetailView(
  row: IngestionException,
  raw: RawObservation | null,
) {
  return {
    ...toExceptionView(row),
    raw: raw
      ? {
          id: raw.id,
          receivedAt: iso(raw.receivedAt),
          messageId: raw.messageId,
          outcome: raw.outcome,
          payload: raw.payload,
          payloadRef: raw.payloadRef,
        }
      : null,
  };
}
export type IngestionExceptionDetailV2View = ReturnType<
  typeof toExceptionDetailView
>;

export function toReplayRunView(run: ReplayRun) {
  return {
    id: run.id,
    connectionId: run.connectionId,
    from: iso(run.fromTime),
    to: iso(run.toTime),
    scopes: run.scopes,
    reason: run.reason,
    dryRun: run.dryRun,
    state: run.state,
    counts: run.counts,
    requestedBy: run.requestedBy,
    lastError: run.lastError,
    createdAt: iso(run.createdAt),
    finishedAt: iso(run.finishedAt),
  };
}
export type ReplayRunV2View = ReturnType<typeof toReplayRunView>;
