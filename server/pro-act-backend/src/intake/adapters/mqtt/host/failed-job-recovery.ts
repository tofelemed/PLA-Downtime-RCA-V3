import { IngestionJobState } from '../../../entities/ingestion-job.entity';

/** What the recovery rule needs of a subscribe job: its state and the health written when it failed. */
export interface FailedJobView {
  state: IngestionJobState;
  health: Record<string, unknown>;
}

/** The connection `config_version` the job's health was last written at, or null when unknown. */
export function failedConfigVersionOf(
  health: Record<string, unknown>,
): number | null {
  const version = health.configVersion;
  return typeof version === 'number' && Number.isFinite(version)
    ? version
    : null;
}

/**
 * A subscription that failed on a non-retryable error (wrong password, TLS trust, egress) is restarted
 * by the host once the connection was corrected: its configuration version moved past the one the job
 * failed at. A job that failed at the CURRENT version stays failed until an operator starts it, so a
 * broken configuration is never retried every sweep. A failure recorded without a version (rows written
 * before the version was tracked) is restarted once; the next failure records the version.
 */
export function recoversAfterConfigChange(
  job: FailedJobView,
  configVersion: number,
): boolean {
  if (job.state !== 'failed') return false;
  const failedAt = failedConfigVersionOf(job.health);
  return failedAt === null || failedAt < configVersion;
}
