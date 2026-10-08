import { IngestionJobState } from '../entities/ingestion-job.entity';

export const JOB_ACTIONS = [
  'start',
  'pause',
  'resume',
  'drain',
  'stop',
] as const;
export type JobAction = (typeof JOB_ACTIONS)[number];

/**
 * Job lifecycle commands (spec ING02). `pause`/`stop` let an in-flight page finish (the runner commits
 * its cursor) and then no new page starts; `drain` keeps reading while data is ready and stops once the
 * source is caught up; `start` also restarts a stopped or failed job from its committed cursor.
 */
const TRANSITIONS: Readonly<
  Record<
    JobAction,
    { from: readonly IngestionJobState[]; to: IngestionJobState }
  >
> = {
  start: { from: ['created', 'stopped', 'failed'], to: 'running' },
  pause: { from: ['running', 'draining'], to: 'paused' },
  resume: { from: ['paused'], to: 'running' },
  drain: { from: ['running'], to: 'draining' },
  stop: {
    from: ['created', 'running', 'paused', 'draining', 'failed'],
    to: 'stopped',
  },
};

/** The state `action` leads to from `current`, or null when the command is not allowed there. */
export function nextJobState(
  current: IngestionJobState,
  action: JobAction,
): IngestionJobState | null {
  const rule = TRANSITIONS[action];
  return rule.from.includes(current) ? rule.to : null;
}

/** States in which the runner may claim a job. */
export const RUNNABLE_STATES: readonly IngestionJobState[] = [
  'running',
  'draining',
];
