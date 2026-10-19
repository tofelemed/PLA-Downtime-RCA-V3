import type { ConnectionTestView, ConnectionView, IngestionJobView } from '@/api/v2/types/integrations';
import { jobPurpose } from './job-presets';
import { plural } from '@/features/ux-kit/format/plural';

/** UX06 stages of one connection, in order (plan 3.7 StageTracker). */
export type StageKey = 'configure' | 'validate' | 'discover' | 'map' | 'limited' | 'quarantine' | 'backfill' | 'production';
export type StageStatus = 'done' | 'attention' | 'pending';

export interface StageResult {
  key: StageKey;
  label: string;
  status: StageStatus;
  detail: string;
  at: string | null;
}

export interface StageFacts {
  connection: ConnectionView;
  /** the last test of this session (tests are not stored server-side) */
  test: { result: ConnectionTestView; at: string } | null;
  /** when this session last sampled source records */
  sampledAt: string | null;
  /** attribute-mapping override versions in force for this connection */
  mappingOverrides: number;
  /** source → plant rules for this connection */
  sourceMappings: number;
  jobs: readonly IngestionJobView[];
  /** open quarantine items of this connection (first page), null while unknown */
  openExceptions: number | null;
}

const LABELS: Record<StageKey, string> = {
  configure: 'Configure',
  validate: 'Validate permissions and capabilities',
  discover: 'Discover sources',
  map: 'Map and preview',
  limited: 'Limited ingestion',
  quarantine: 'Resolve quarantine',
  backfill: 'Bounded backfill',
  production: 'Production job with health',
};

const stage = (key: StageKey, status: StageStatus, detail: string, at: string | null = null): StageResult => ({ key, label: LABELS[key], status, detail, at });

const jobsOf = (facts: StageFacts, purpose: string) => facts.jobs.filter((job) => jobPurpose(job) === purpose);

function jobStage(key: 'limited' | 'backfill' | 'production', facts: StageFacts): StageResult {
  const jobs = jobsOf(facts, key);
  const failed = jobs.find((job) => job.state === 'failed');
  if (failed) return stage(key, 'attention', `Job failed: ${failed.lastError ?? 'see the job'}`, failed.updatedAt);
  const read = jobs.find((job) => job.lastSuccessAt !== null);
  if (read) return stage(key, 'done', `${plural(jobs.length, 'job', 'jobs')}; data read, last at`, read.lastSuccessAt);
  if (jobs.length > 0) return stage(key, 'attention', `${plural(jobs.length, 'job', 'jobs')}, nothing read yet; created`, jobs[0].createdAt);
  return stage(key, 'pending', 'No job of this kind yet');
}

/**
 * Each UX06 stage with its result, from what the server reports (connection, mappings, jobs, quarantine)
 * plus this session's test and sample. A reachable source is never shown as "accounting works": the
 * production stage is done only when a production job has committed a read.
 */
export function ux06Stages(facts: StageFacts): StageResult[] {
  const test = facts.test;
  const quarantine =
    facts.openExceptions === null
      ? stage('quarantine', 'pending', 'Quarantine not loaded')
      : facts.openExceptions > 0
        ? stage('quarantine', 'attention', plural(facts.openExceptions, 'open item', 'open items'))
        : stage('quarantine', facts.jobs.length > 0 ? 'done' : 'pending', facts.jobs.length > 0 ? 'No open items' : 'Nothing ingested yet');
  return [
    stage('configure', 'done', `Config v${facts.connection.configVersion}, ${facts.connection.hasSecret ? 'credential stored' : 'no credential'}`, facts.connection.createdAt),
    test
      ? stage('validate', test.result.connected ? 'done' : 'attention', test.result.message, test.at)
      : stage('validate', 'pending', 'Run the diagnostics'),
    facts.sampledAt ? stage('discover', 'done', 'Source records sampled', facts.sampledAt) : stage('discover', 'pending', 'Sample source records'),
    facts.mappingOverrides + facts.sourceMappings > 0
      ? stage('map', 'done', `${plural(facts.sourceMappings, 'source binding', 'source bindings')}, ${plural(facts.mappingOverrides, 'attribute override', 'attribute overrides')}`)
      : stage('map', 'pending', 'Bind sources and check the typed preview'),
    jobStage('limited', facts),
    quarantine,
    jobStage('backfill', facts),
    jobStage('production', facts),
  ];
}
