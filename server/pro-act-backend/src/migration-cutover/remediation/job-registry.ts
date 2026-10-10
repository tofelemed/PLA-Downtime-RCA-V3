import { duplicatesJob, durationsJob, sentinelsJob } from './jobs/event-jobs';
import { legacyValuesJob, linksJob } from './jobs/legacy-value-jobs';
import { rateJob, reasonTreeJob, unitsJob } from './jobs/master-data-jobs';
import { periodsJob } from './jobs/period-job';
import { referencesJob } from './jobs/reference-job';
import { PlanSource } from './remediation-types';

/**
 * The §18.2 remediation table, in run order: references first (later jobs scope by tenant), then the
 * event fixes, then the legacy values and their links / periods, then master data flags.
 */
export const REMEDIATION_JOBS: readonly PlanSource[] = [
  referencesJob,
  sentinelsJob,
  durationsJob,
  duplicatesJob,
  legacyValuesJob,
  linksJob,
  periodsJob,
  reasonTreeJob,
  rateJob,
  unitsJob,
];

export function findRemediationJob(name: string): PlanSource | undefined {
  return REMEDIATION_JOBS.find((job) => job.name === name);
}
