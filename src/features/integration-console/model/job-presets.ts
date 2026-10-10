import type { JobCreateBody } from '@/api/v2/queries/ingestion-jobs';
import type { IngestionJobView } from '@/api/v2/types/integrations';

/**
 * The three UX06 job kinds (plan 3.7), all PI `window` jobs (1.6) that differ in lookback, page size and
 * cadence. `purpose` is kept in the job scope so the stage tracker can tell them apart from the server's
 * record (it is ignored by the adapter and makes each kind its own scope):
 * - limited: a short first window, small pages — check the mapping on live data;
 * - backfill: `days` back on the first run, then drained (stops once caught up) — bounded history;
 * - production: the regular cadence (60 s) with the standard 60 min first window.
 */
export type JobPurpose = 'limited' | 'backfill' | 'production';

export interface JobPresetInput {
  purpose: JobPurpose;
  scopeType: 'database' | 'element';
  scopeId: string;
  templateName: string | null;
  /** limited: minutes back on the first run */
  lookbackMinutes?: number;
  /** backfill: days back on the first run (1–90) */
  days?: number;
}

export const BACKFILL_MAX_DAYS = 90;
const DAY_MINUTES = 1440;

const PRESET: Record<JobPurpose, { intervalSeconds: number; pageSize: number }> = {
  limited: { intervalSeconds: 60, pageSize: 50 },
  backfill: { intervalSeconds: 300, pageSize: 500 },
  production: { intervalSeconds: 60, pageSize: 500 },
};

function lookbackOf(input: JobPresetInput): number {
  if (input.purpose === 'backfill') return Math.min(Math.max(1, Math.round(input.days ?? 7)), BACKFILL_MAX_DAYS) * DAY_MINUTES;
  if (input.purpose === 'limited') return Math.max(1, Math.round(input.lookbackMinutes ?? 120));
  return 60;
}

/** Body of POST /connections/{id}/jobs for a preset; every kind starts right away. */
export function presetJobBody(input: JobPresetInput): JobCreateBody {
  const scope: Record<string, unknown> = {
    mode: 'window',
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    lookbackMinutes: lookbackOf(input),
    purpose: input.purpose,
  };
  if (input.templateName) scope.templateName = input.templateName;
  return { scope, cadence: PRESET[input.purpose], start: true };
}

/** The UX06 purpose recorded in a job's scope, if the console created it. */
export function jobPurpose(job: Pick<IngestionJobView, 'scope'>): JobPurpose | null {
  const purpose = job.scope.purpose;
  return purpose === 'limited' || purpose === 'backfill' || purpose === 'production' ? purpose : null;
}

const str = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** One line of what a job reads: mode, scope, template and first window. */
export function scopeSummary(scope: Record<string, unknown>): string {
  const parts = [str(scope.mode) ?? 'window'];
  const scopeType = str(scope.scopeType);
  const scopeId = str(scope.scopeId);
  if (scopeType && scopeId) parts.push(`${scopeType} ${scopeId}`);
  const template = str(scope.templateName);
  parts.push(template ? `template ${template}` : 'all templates');
  if (typeof scope.lookbackMinutes === 'number') parts.push(`first window ${scope.lookbackMinutes} min`);
  return parts.join(' · ');
}
