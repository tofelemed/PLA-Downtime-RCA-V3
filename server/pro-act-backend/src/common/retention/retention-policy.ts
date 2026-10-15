/**
 * Data retention windows (DB-07), read from the environment only: unset or empty = keep forever. Owner
 * decisions: 30 days for both audit tables (2026-10-14), raw source observations 1 year and signal samples
 * 90 days (2026-10-15). docker-compose passes `AUDIT_REQUEST_LOG_RETENTION_DAYS` /
 * `AUDIT_TRAIL_RETENTION_DAYS` = 30, `RAW_RETENTION_DAYS` = 365 and `SAMPLE_RETENTION_DAYS` = 90 by
 * default; other runs set them in `.env`. A set value must be a whole number of days ≥ 1; anything else is
 * a configuration error and nothing is deleted.
 */
export interface RetentionPolicy {
  /** `audit_logs`, the request log of the global audit interceptor (by `timestamp`) */
  requestLogDays: number | null;
  /** `audit_log`, the append-only trail of domain commands (by `at`) */
  auditTrailDays: number | null;
  /** monthly `raw_observations` partitions whose whole month is older than the window are dropped */
  rawDays: number | null;
  /** monthly `measurement_samples` partitions whose whole month is older than the window are dropped */
  sampleDays: number | null;
  /** rows deleted per statement */
  batchSize: number;
}

export class RetentionConfigError extends Error {}

const DEFAULT_BATCH = 1000;

/** A whole number ≥ 1, or null when unset / empty. */
function positiveInt(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): number | null {
  const raw = env[name]?.trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new RetentionConfigError(
      `${name} must be a whole number >= 1 (unset = keep forever), got "${raw}"`,
    );
  }
  return Number(raw);
}

export function readRetentionPolicy(
  env: Readonly<Record<string, string | undefined>> = process.env,
): RetentionPolicy {
  return {
    requestLogDays: positiveInt(env, 'AUDIT_REQUEST_LOG_RETENTION_DAYS'),
    auditTrailDays: positiveInt(env, 'AUDIT_TRAIL_RETENTION_DAYS'),
    rawDays: positiveInt(env, 'RAW_RETENTION_DAYS'),
    sampleDays: positiveInt(env, 'SAMPLE_RETENTION_DAYS'),
    batchSize: positiveInt(env, 'RETENTION_BATCH') ?? DEFAULT_BATCH,
  };
}

export const isRetentionEnabled = (policy: RetentionPolicy) =>
  policy.requestLogDays !== null ||
  policy.auditTrailDays !== null ||
  policy.rawDays !== null ||
  policy.sampleDays !== null;
