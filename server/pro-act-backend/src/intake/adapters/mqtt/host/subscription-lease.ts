import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { IngestionJobState } from '../../../entities/ingestion-job.entity';
import { scopeHash } from '../../../jobs/ingestion-jobs.service';
import {
  JobLease,
  recordTransition,
  SUBSCRIBE_MODE,
} from '../../../jobs/job-lease';
import { failedConfigVersionOf } from './failed-job-recovery';
import { SubscriptionHealth } from './subscription-health';

/** The `ingestion_jobs` row of a subscription as the host reads it. */
export interface SubscribeJobRow {
  id: string;
  tenantId: string;
  connectionId: string;
  state: IngestionJobState;
  scope: Record<string, unknown>;
  leaseOwner: string | null;
  leaseExpiry: Date | null;
  health: Record<string, unknown>;
}

interface JobRecord {
  id: string;
  tenant_id: string;
  connection_id: string;
  state: IngestionJobState;
  scope: Record<string, unknown>;
  lease_owner: string | null;
  lease_expiry: Date | null;
  health: Record<string, unknown>;
}

const SELECT =
  `SELECT "id", "tenant_id", "connection_id", "state", "scope", "lease_owner", "lease_expiry", "health" ` +
  `FROM "ingestion_jobs"`;

/** Codes of parked (not applied) deliveries the health counter reports (design §4.2 stages 5–7). */
const PARKED_CODES = ['unknown_template', 'unknown_signal', 'unknown_code'];

function rowOf(record: JobRecord): SubscribeJobRow {
  return {
    id: record.id,
    tenantId: record.tenant_id,
    connectionId: record.connection_id,
    state: record.state,
    scope: record.scope,
    leaseOwner: record.lease_owner,
    leaseExpiry: record.lease_expiry,
    health: record.health,
  };
}

/** The newest subscription job of a connection in any state (a stopped one waits for `start`). */
export async function findSubscribeJob(
  manager: EntityManager,
  connectionId: string,
): Promise<SubscribeJobRow | null> {
  const rows: JobRecord[] = await manager.query(
    `${SELECT} WHERE "connection_id" = $1 AND "scope"->>'mode' = $2 ORDER BY "created_at" DESC, "id" DESC LIMIT 1`,
    [connectionId, SUBSCRIBE_MODE],
  );
  return rows[0] ? rowOf(rows[0]) : null;
}

/**
 * Creates the subscription job of an active connection, already running and never due
 * (`next_run_at` null); the audit trail names the host as the actor of `create` and `start`.
 */
export async function createSubscribeJob(
  manager: EntityManager,
  input: {
    tenantId: string;
    connectionId: string;
    scope: Record<string, unknown>;
    runner: string;
  },
): Promise<SubscribeJobRow> {
  const id = randomUUID();
  const scope = { ...input.scope, mode: SUBSCRIBE_MODE };
  const rows: JobRecord[] = await manager.query(
    `INSERT INTO "ingestion_jobs" ("id", "tenant_id", "connection_id", "scope", "scope_hash", "state", "cadence",
            "next_run_at", "health", "row_version")
     VALUES ($1, $2, $3, $4::jsonb, $5, 'running', '{"intervalSeconds": 0}'::jsonb, NULL, '{}'::jsonb, 1)
     RETURNING "id", "tenant_id", "connection_id", "state", "scope", "lease_owner", "lease_expiry", "health"`,
    [
      id,
      input.tenantId,
      input.connectionId,
      JSON.stringify(scope),
      scopeHash(scope),
    ],
  );
  for (const [action, from] of [
    ['create', 'created'],
    ['start', 'created'],
  ] as const) {
    await recordTransition(manager, {
      tenantId: input.tenantId,
      jobId: id,
      action,
      fromState: from,
      toState: action === 'create' ? 'created' : 'running',
      actorId: null,
      runner: input.runner,
      detail: { subscription: true },
    });
  }
  return rowOf(rows[0]);
}

/** The scope of a subscription follows the connection (topics, profile); one row per connection. */
export async function updateSubscribeScope(
  manager: EntityManager,
  jobId: string,
  scope: Record<string, unknown>,
): Promise<void> {
  const next = { ...scope, mode: SUBSCRIBE_MODE };
  await manager.query(
    `UPDATE "ingestion_jobs" SET "scope" = $2::jsonb, "scope_hash" = $3, "updated_at" = now(), "row_version" = "row_version" + 1
      WHERE "id" = $1`,
    [jobId, JSON.stringify(next), scopeHash(next)],
  );
}

export interface SubscriptionClaim {
  claimed: boolean;
  /** owner of the expired lease this claim took over (a dead worker), if any */
  previousOwner: string | null;
}

/**
 * Takes or renews the lease of a running / draining subscription (`runnerIdentity()`, 60 s). Refused
 * while another live worker holds it: a persistent MQTT session belongs to exactly one client id.
 */
export async function claimSubscription(
  manager: EntityManager,
  jobId: string,
  owner: string,
  leaseSeconds: number,
): Promise<SubscriptionClaim> {
  const [rows]: [Array<{ previous_owner: string | null }>, number] =
    await manager.query(
      `WITH "candidate" AS (
           SELECT "id", "lease_owner", "lease_expiry" FROM "ingestion_jobs"
            WHERE "id" = $1 AND "state" IN ('running', 'draining')
              AND ("lease_owner" IS NULL OR "lease_owner" = $2 OR "lease_expiry" IS NULL OR "lease_expiry" < now())
            FOR UPDATE SKIP LOCKED)
         UPDATE "ingestion_jobs" "j" SET "lease_owner" = $2, "lease_expiry" = now() + make_interval(secs => $3),
                "heartbeat_at" = now(), "next_run_at" = NULL, "updated_at" = now(), "row_version" = "j"."row_version" + 1
           FROM "candidate" WHERE "j"."id" = "candidate"."id"
         RETURNING CASE WHEN "candidate"."lease_owner" = $2 THEN NULL ELSE "candidate"."lease_owner" END AS "previous_owner"`,
      [jobId, owner, leaseSeconds],
    );
  return rows[0]
    ? { claimed: true, previousOwner: rows[0].previous_owner }
    : { claimed: false, previousOwner: null };
}

/** Extends the lease and merges the live health; false when the lease is no longer ours. */
export async function heartbeatSubscription(
  manager: EntityManager,
  lease: JobLease,
  health: SubscriptionHealth,
  lastObservationAt: Date | null,
): Promise<boolean> {
  const [rows]: [unknown[], number] = await manager.query(
    `UPDATE "ingestion_jobs" SET "heartbeat_at" = now(), "lease_expiry" = now() + make_interval(secs => $3),
            "health" = coalesce("health", '{}'::jsonb) || $4::jsonb,
            "last_observation_at" = greatest(coalesce($5, "last_observation_at"), "last_observation_at"),
            "last_success_at" = CASE WHEN $6 THEN now() ELSE "last_success_at" END,
            "updated_at" = now()
      WHERE "id" = $1 AND "lease_owner" = $2 RETURNING "id"`,
    [
      lease.jobId,
      lease.owner,
      lease.leaseSeconds,
      JSON.stringify(health),
      lastObservationAt,
      health.connected && health.persistFailed === null,
    ],
  );
  return rows.length > 0;
}

/** Releases our lease (pause, stop, shutdown, lost connection) and records the final health. */
export async function releaseSubscription(
  manager: EntityManager,
  lease: JobLease,
  health: SubscriptionHealth,
): Promise<void> {
  await manager.query(
    `UPDATE "ingestion_jobs" SET "lease_owner" = NULL, "lease_expiry" = NULL,
            "health" = coalesce("health", '{}'::jsonb) || $3::jsonb, "updated_at" = now(), "row_version" = "row_version" + 1
      WHERE "id" = $1 AND "lease_owner" = $2`,
    [lease.jobId, lease.owner, JSON.stringify(health)],
  );
}

/**
 * A non-retryable connect failure (auth, egress, TLS): the job fails at once and is audited with the
 * connection version it failed at (`health.configVersion`, so the host knows when a correction landed).
 */
export async function failSubscription(
  manager: EntityManager,
  lease: JobLease,
  input: {
    error: string;
    health: SubscriptionHealth;
    from: IngestionJobState;
    configVersion: number | null;
  },
): Promise<void> {
  await manager.query(
    `UPDATE "ingestion_jobs" SET "state" = 'failed', "last_error" = $3, "retry_count" = "retry_count" + 1,
            "health" = coalesce("health", '{}'::jsonb) || $4::jsonb,
            "lease_owner" = NULL, "lease_expiry" = NULL, "updated_at" = now(), "row_version" = "row_version" + 1
      WHERE "id" = $1 AND "lease_owner" = $2`,
    [
      lease.jobId,
      lease.owner,
      input.error.slice(0, 2000),
      JSON.stringify(input.health),
    ],
  );
  await recordTransition(manager, {
    tenantId: lease.tenantId,
    jobId: lease.jobId,
    action: 'failed',
    fromState: input.from,
    toState: 'failed',
    actorId: null,
    runner: lease.owner,
    detail: {
      error: input.error.slice(0, 500),
      configVersion: input.configVersion,
    },
  });
}

/**
 * Restarts a job that failed at an older configuration version now that the connection was corrected
 * (`failed → running`, audited `config_changed` by the host; the retry budget and last error reset like
 * an operator `start`). Returns the row as running, or null when the job is no longer failed.
 */
export async function restartFailedJob(
  manager: EntityManager,
  job: SubscribeJobRow,
  input: { configVersion: number; runner: string },
): Promise<SubscribeJobRow | null> {
  const [rows]: [JobRecord[], number] = await manager.query(
    `UPDATE "ingestion_jobs" SET "state" = 'running', "retry_count" = 0, "last_error" = NULL,
            "lease_owner" = NULL, "lease_expiry" = NULL, "next_run_at" = NULL, "updated_at" = now(),
            "row_version" = "row_version" + 1
      WHERE "id" = $1 AND "state" = 'failed'
      RETURNING "id", "tenant_id", "connection_id", "state", "scope", "lease_owner", "lease_expiry", "health"`,
    [job.id],
  );
  if (!rows[0]) return null;
  await recordTransition(manager, {
    tenantId: job.tenantId,
    jobId: job.id,
    action: 'config_changed',
    fromState: 'failed',
    toState: 'running',
    actorId: null,
    runner: input.runner,
    detail: {
      failedConfigVersion: failedConfigVersionOf(job.health),
      configVersion: input.configVersion,
    },
  });
  return rowOf(rows[0]);
}

/** A draining subscription that finished its in-flight message becomes `stopped` (audited `drained`). */
export async function finishDrain(
  manager: EntityManager,
  lease: JobLease,
  health: SubscriptionHealth,
): Promise<void> {
  await manager.query(
    `UPDATE "ingestion_jobs" SET "state" = 'stopped', "health" = coalesce("health", '{}'::jsonb) || $3::jsonb,
            "lease_owner" = NULL, "lease_expiry" = NULL, "updated_at" = now(), "row_version" = "row_version" + 1
      WHERE "id" = $1 AND "lease_owner" = $2 AND "state" = 'draining'`,
    [lease.jobId, lease.owner, JSON.stringify(health)],
  );
  await recordTransition(manager, {
    tenantId: lease.tenantId,
    jobId: lease.jobId,
    action: 'drained',
    fromState: 'draining',
    toState: 'stopped',
    actorId: null,
    runner: lease.owner,
    detail: null,
  });
}

/** Open parking rows of the connection (the `parked` counter of the health). */
export async function countParked(
  manager: EntityManager,
  connectionId: string,
): Promise<number> {
  const rows: Array<{ count: number }> = await manager.query(
    `SELECT count(*)::int AS "count" FROM "ingestion_exceptions"
      WHERE "connection_id" = $1 AND "state" = 'open' AND "error_code"::text = ANY($2)`,
    [connectionId, PARKED_CODES],
  );
  return rows[0]?.count ?? 0;
}
