import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IngestionJobTransition } from '../entities/ingestion-job-transition.entity';

/** The runner's hold on one job. */
export interface JobLease {
  jobId: string;
  tenantId: string;
  owner: string;
  leaseSeconds: number;
}

export interface ClaimedJob {
  id: string;
  tenantId: string;
  /** owner of the expired lease this claim took over, if any (a dead worker) */
  previousOwner: string | null;
}

/** What a successfully accepted page commits. */
export interface PageCommit {
  cursor: Record<string, unknown>;
  hasMore: boolean;
  intervalSeconds: number;
  health: Record<string, number>;
  /** latest source observation time among the page's records */
  lastObservationAt: Date | null;
}

/** Jobs the pull runner never claims: subscriptions are hosted by `MqttSubscriberHost` (plan 1.8). */
export const SUBSCRIBE_MODE = 'subscribe';

/**
 * Claims the most overdue runnable job whose lease is free or expired (ING02: one lease per job, i.e.
 * per connection + scope). `SKIP LOCKED` keeps concurrent runners from waiting on each other. A
 * subscription has `next_run_at` null and is excluded by its scope as well (defence in depth). Jobs of a
 * deactivated connection are not claimed: deactivating a connection stops its reads until it is
 * activated again (the jobs keep their state and cursor).
 */
export async function claimDueJob(
  manager: EntityManager,
  owner: string,
  leaseSeconds: number,
): Promise<ClaimedJob | null> {
  // a data-modifying CTE ending in UPDATE answers [rows, rowCount] through TypeORM's postgres driver
  const [rows]: [
    Array<{ id: string; tenant_id: string; previous_owner: string | null }>,
    number,
  ] = await manager.query(
    `WITH "candidate" AS (
         SELECT "job"."id", "job"."lease_owner" FROM "ingestion_jobs" "job"
           JOIN "integration_connections" "connection" ON "connection"."id" = "job"."connection_id"
          WHERE "job"."state" IN ('running', 'draining') AND "job"."next_run_at" <= now()
            AND "connection"."is_active"
            AND coalesce("job"."scope"->>'mode', '') <> '${SUBSCRIBE_MODE}'
            AND ("job"."lease_expiry" IS NULL OR "job"."lease_expiry" < now())
          ORDER BY "job"."next_run_at" LIMIT 1 FOR UPDATE OF "job" SKIP LOCKED)
       UPDATE "ingestion_jobs" "j" SET "lease_owner" = $1, "lease_expiry" = now() + make_interval(secs => $2),
              "heartbeat_at" = now(), "updated_at" = now(), "row_version" = "j"."row_version" + 1
         FROM "candidate" WHERE "j"."id" = "candidate"."id"
       RETURNING "j"."id", "j"."tenant_id", "candidate"."lease_owner" AS "previous_owner"`,
    [owner, leaseSeconds],
  );
  const row = firstRow(rows);
  return row
    ? { id: row.id, tenantId: row.tenant_id, previousOwner: row.previous_owner }
    : null;
}

/** Extends the lease; false when it is no longer ours (expired and taken over). */
export async function heartbeat(
  manager: EntityManager,
  lease: JobLease,
): Promise<boolean> {
  const [rows]: [unknown[], number] = await manager.query(
    `UPDATE "ingestion_jobs" SET "heartbeat_at" = now(), "lease_expiry" = now() + make_interval(secs => $3)
      WHERE "id" = $1 AND "lease_owner" = $2 RETURNING "id"`,
    [lease.jobId, lease.owner, lease.leaseSeconds],
  );
  return rows.length > 0;
}

/**
 * Commits the cursor of a fully accepted page and releases the lease (FND01: only now). A draining job
 * that is caught up becomes `stopped`. Returns the resulting state, or null when the lease was lost.
 */
export async function commitPage(
  manager: EntityManager,
  lease: JobLease,
  commit: PageCommit,
): Promise<string | null> {
  const [rows]: [Array<{ state: string }>, number] = await manager.query(
    `UPDATE "ingestion_jobs" SET "committed_cursor" = $3::jsonb, "last_success_at" = now(),
            "last_observation_at" = coalesce($7, "last_observation_at"), "retry_count" = 0, "last_error" = NULL, "health" = $4::jsonb,
            "next_run_at" = now() + make_interval(secs => $5),
            "state" = CASE WHEN "state" = 'draining' AND NOT $6 THEN 'stopped'::ingestion_job_state ELSE "state" END,
            "lease_owner" = NULL, "lease_expiry" = NULL, "updated_at" = now(), "row_version" = "row_version" + 1
      WHERE "id" = $1 AND "lease_owner" = $2 RETURNING "state"`,
    [
      lease.jobId,
      lease.owner,
      JSON.stringify(commit.cursor),
      JSON.stringify(commit.health),
      commit.hasMore ? 0 : commit.intervalSeconds,
      commit.hasMore,
      commit.lastObservationAt,
    ],
  );
  return firstRow(rows)?.state ?? null;
}

/** Why a page failed and how the job continues. */
export interface PageFailure {
  error: string;
  delaySeconds: number;
  /** the job becomes `failed` once its retry count reaches this (0 = at once) */
  maxRetries: number;
  /** replaces the job health when set (e.g. `{ auth_failed: 1 }`) */
  health?: Record<string, number> | null;
}

/**
 * A failed page: nothing is committed, the retry is scheduled with backoff and the lease released;
 * after `maxRetries` the job becomes `failed`. Returns the resulting state (null = lease lost).
 */
export async function failPage(
  manager: EntityManager,
  lease: JobLease,
  failure: PageFailure,
): Promise<string | null> {
  const [rows]: [Array<{ state: string }>, number] = await manager.query(
    `UPDATE "ingestion_jobs" SET "retry_count" = "retry_count" + 1, "last_error" = $3,
            "next_run_at" = now() + make_interval(secs => $4),
            "state" = CASE WHEN "retry_count" + 1 >= $5 THEN 'failed'::ingestion_job_state ELSE "state" END,
            "health" = coalesce($6::jsonb, "health"),
            "lease_owner" = NULL, "lease_expiry" = NULL, "updated_at" = now(), "row_version" = "row_version" + 1
      WHERE "id" = $1 AND "lease_owner" = $2 RETURNING "state"`,
    [
      lease.jobId,
      lease.owner,
      failure.error,
      failure.delaySeconds,
      failure.maxRetries,
      failure.health ? JSON.stringify(failure.health) : null,
    ],
  );
  return firstRow(rows)?.state ?? null;
}

/** Appends an audit row of the job lifecycle. */
export async function recordTransition(
  manager: EntityManager,
  row: Omit<IngestionJobTransition, 'id' | 'createdAt' | 'job'>,
): Promise<void> {
  await manager.insert(
    IngestionJobTransition,
    row as unknown as QueryDeepPartialEntity<IngestionJobTransition>,
  );
}

function firstRow<T>(rows: T[]): T | undefined {
  return rows[0];
}
