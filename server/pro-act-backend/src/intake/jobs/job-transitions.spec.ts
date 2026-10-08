import {
  INGESTION_JOB_STATES,
  IngestionJobState,
} from '../entities/ingestion-job.entity';
import { JOB_ACTIONS, JobAction, nextJobState } from './job-transitions';

/** ING02 lifecycle: every (state, action) pair, so a new state or action cannot slip in untested. */
const EXPECTED: Record<
  IngestionJobState,
  Record<JobAction, IngestionJobState | null>
> = {
  created: {
    start: 'running',
    pause: null,
    resume: null,
    drain: null,
    stop: 'stopped',
  },
  running: {
    start: null,
    pause: 'paused',
    resume: null,
    drain: 'draining',
    stop: 'stopped',
  },
  paused: {
    start: null,
    pause: null,
    resume: 'running',
    drain: null,
    stop: 'stopped',
  },
  draining: {
    start: null,
    pause: 'paused',
    resume: null,
    drain: null,
    stop: 'stopped',
  },
  stopped: {
    start: 'running',
    pause: null,
    resume: null,
    drain: null,
    stop: null,
  },
  failed: {
    start: 'running',
    pause: null,
    resume: null,
    drain: null,
    stop: 'stopped',
  },
};

describe('nextJobState (plan 1.5, ING02)', () => {
  const pairs = INGESTION_JOB_STATES.flatMap((state) =>
    JOB_ACTIONS.map((action) => [state, action] as const),
  );

  it.each(pairs)('%s + %s', (state, action) => {
    expect(nextJobState(state, action)).toBe(EXPECTED[state][action]);
  });
});
