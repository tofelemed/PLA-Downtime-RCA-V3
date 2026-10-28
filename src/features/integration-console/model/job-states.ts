import type { IngestionJobView, JobAction, JobState } from '@/api/v2/types/integrations';
import { secondsSince } from '../mqtt/model/mqtt-health';

export type Tone = 'ok' | 'busy' | 'idle' | 'warning' | 'error';

export const JOB_STATE_DISPLAY: Record<JobState, { label: string; tone: Tone }> = {
  created: { label: 'Created', tone: 'idle' },
  running: { label: 'Running', tone: 'ok' },
  draining: { label: 'Draining (stops when caught up)', tone: 'busy' },
  paused: { label: 'Paused', tone: 'idle' },
  stopped: { label: 'Stopped', tone: 'idle' },
  failed: { label: 'Failed', tone: 'error' },
};

/**
 * Commands offered per state — the same table as the server (`job-transitions.ts`); the server stays the
 * judge (409 INVALID_TRANSITION is shown as refused), the console only avoids offering dead buttons.
 */
const ACTIONS: Record<JobState, readonly JobAction[]> = {
  created: ['start', 'stop'],
  running: ['pause', 'drain', 'stop'],
  draining: ['pause', 'stop'],
  paused: ['resume', 'stop'],
  stopped: ['start'],
  failed: ['start', 'stop'],
};

export function allowedActions(state: JobState): readonly JobAction[] {
  return ACTIONS[state];
}

export const ACTION_TEXT: Record<JobAction, { label: string; confirm: string; destructive: boolean }> = {
  start: { label: 'Start', confirm: 'Start reading from the committed cursor (a stopped or failed job resumes from its checkpoint).', destructive: false },
  pause: { label: 'Pause', confirm: 'The page in flight finishes and commits its cursor; no new page starts until resumed.', destructive: false },
  resume: { label: 'Resume', confirm: 'Continue from the committed cursor.', destructive: false },
  drain: { label: 'Drain', confirm: 'Keep reading while data is ready, then stop once the source is caught up.', destructive: false },
  stop: { label: 'Stop', confirm: 'The page in flight finishes and commits its cursor; the job then stops for good until started again.', destructive: true },
};

export interface JobHealth {
  tone: Tone;
  labels: string[];
}

const FAILURE_LABELS: Record<string, string> = {
  auth_failed: 'Authentication failed',
  authz_failed: 'Not authorized',
  not_found: 'Scope not found',
  unsupported: 'Not supported by the source',
  request_rejected: 'Request rejected',
  source_unavailable: 'Source unavailable',
  unreachable: 'Source unreachable',
  tls_failed: 'TLS failed',
  response_too_large: 'Response too large',
};

/** Badges of a job: failure codes, retries, a lost lease or missing heartbeat while it should run. */
export function jobHealth(job: IngestionJobView, now: number): JobHealth {
  const labels = Object.keys(job.health).filter((code) => code in FAILURE_LABELS).map((code) => FAILURE_LABELS[code]);
  if (job.state === 'failed') return { tone: 'error', labels: labels.length > 0 ? labels : ['Failed'] };
  if (labels.length > 0) return { tone: 'error', labels };
  if (job.retryCount > 0) return { tone: 'warning', labels: [`Retrying (${job.retryCount})`] };
  const runnable = job.state === 'running' || job.state === 'draining';
  const leaseLost = runnable && job.leaseExpiry !== null && Date.parse(job.leaseExpiry) < now;
  if (leaseLost) return { tone: 'warning', labels: ['No live lease (waiting for a worker)'] };
  if (runnable) return { tone: 'ok', labels: ['Healthy'] };
  return { tone: 'idle', labels: [JOB_STATE_DISPLAY[job.state].label] };
}

/** Signed age of the last heartbeat and of the last committed observation, in seconds (null = never; negative = ahead of `now`). */
export function jobAges(job: IngestionJobView, now: number): { heartbeat: number | null; observation: number | null } {
  return { heartbeat: secondsSince(job.heartbeatAt, now), observation: secondsSince(job.lastObservationAt, now) };
}

/** Outcome counts of the last page (accepted, duplicate, quarantined …), failure codes excluded. */
export function pageOutcomes(job: IngestionJobView): Array<[string, number]> {
  return Object.entries(job.health).filter(([code]) => !(code in FAILURE_LABELS));
}
