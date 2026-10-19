import { EntityManager } from 'typeorm';
import { defaultSiteOf } from '../close/close-calendar';
import { ExportReportType } from './entities/export-job.entity';

/** A reason code as it was named when the export was requested. */
export interface PinnedReasonCode {
  code: string;
  name: string;
}

/**
 * Readable labels of an export, pinned on the job when it is requested (`export_jobs.labels`, QA audit
 * 2026-10-19), so re-rendering a job reproduces its bytes even after a rename: the requester's name, the
 * plant clock the plant-time columns use, and the reason codes the pinned loss lines refer to.
 */
export interface ExportLabels {
  requestedByName: string | null;
  /** IANA zone of the plant (default site's published calendar, else the plant's own); null = none set */
  plantTimezone: string | null;
  /** reason code id → code and name (loss-line exports only; empty for period summaries) */
  reasonCodes: Record<string, PinnedReasonCode>;
}

/** Reason codes referred to by the candidates and lines of the job's pinned approval snapshots. */
const PINNED_REASONS = `
  SELECT DISTINCT rc."id"::text AS "id", rc."code", rc."name"
    FROM "export_job_sources" s
    JOIN "approval_snapshots" a ON a."id" = s."snapshot_id"
    CROSS JOIN LATERAL (
      SELECT x->>'reasonCodeId' AS "reason_id"
        FROM jsonb_array_elements(COALESCE(a."content"->'reviewed'->'candidates', '[]'::jsonb)) x
      UNION
      SELECT x->>'reasonCodeId'
        FROM jsonb_array_elements(COALESCE(a."content"->'reviewed'->'lines', '[]'::jsonb)) x
    ) ids
    JOIN "reason_codes" rc ON rc."id"::text = ids."reason_id"
   WHERE s."export_job_id" = $1 AND (rc."tenant_id" = $2 OR rc."tenant_id" IS NULL)`;

async function reasonCodesOf(
  manager: EntityManager,
  ids: { tenantId: string; jobId: string },
): Promise<Record<string, PinnedReasonCode>> {
  const rows: Array<{ id: string; code: string; name: string }> =
    await manager.query(PINNED_REASONS, [ids.jobId, ids.tenantId]);
  return Object.fromEntries(
    rows
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((r) => [r.id, { code: r.code, name: r.name }]),
  );
}

async function plantTimezoneOf(
  manager: EntityManager,
  tenantId: string,
): Promise<string | null> {
  const site = await defaultSiteOf(manager, tenantId);
  if (site?.timezone) return site.timezone;
  const rows: Array<{ timezone: string | null }> = await manager.query(
    `SELECT "timezone" FROM "tenants" WHERE "id" = $1`,
    [tenantId],
  );
  return rows[0]?.timezone ?? null;
}

async function userNameOf(
  manager: EntityManager,
  userId: string,
): Promise<string | null> {
  const rows: Array<{ name: string | null }> = await manager.query(
    `SELECT "name" FROM "users" WHERE "id" = $1`,
    [userId],
  );
  return rows[0]?.name ?? null;
}

/** The labels to pin on a job once its sources are pinned (same transaction as the request). */
export async function pinnedLabelsOf(
  manager: EntityManager,
  job: {
    id: string;
    tenantId: string;
    requestedBy: string;
    reportType: ExportReportType;
  },
): Promise<ExportLabels> {
  return {
    requestedByName: await userNameOf(manager, job.requestedBy),
    plantTimezone: await plantTimezoneOf(manager, job.tenantId),
    reasonCodes:
      job.reportType === 'loss_lines'
        ? await reasonCodesOf(manager, {
            tenantId: job.tenantId,
            jobId: job.id,
          })
        : {},
  };
}
