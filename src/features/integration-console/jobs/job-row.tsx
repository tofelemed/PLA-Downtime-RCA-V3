import { useState } from 'react';
import type { IngestionJobView, JobAction } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { DurationText } from '@/features/ux-kit/duration-text';
import { ToneBadge } from '../components/tone-badge';
import { jobPurpose, scopeSummary } from '../model/job-presets';
import { ACTION_TEXT, allowedActions, jobAges, jobHealth, JOB_STATE_DISPLAY, pageOutcomes } from '../model/job-states';
import { JobCommandDialog } from './job-command-dialog';
import { JobTransitions } from './job-transitions';

export interface JobRowProps {
  job: IngestionJobView;
  timezone: string;
  now: number;
}

const ago = (seconds: number | null) => (seconds === null ? 'never' : <><DurationText seconds={seconds} variant="compact" /> ago</>);

/** One job: state, health badges, scope, lease and cursor ages, last page outcomes, commands, audit trail. */
export function JobRow({ job, timezone, now }: JobRowProps) {
  const [action, setAction] = useState<JobAction | null>(null);
  const [trail, setTrail] = useState(false);
  const state = JOB_STATE_DISPLAY[job.state];
  const health = jobHealth(job, now);
  const ages = jobAges(job, now);
  return (
    <li className="space-y-2 rounded-md border p-3 text-sm" data-testid="job-row" data-job-id={job.id} data-state={job.state} data-purpose={jobPurpose(job) ?? 'other'}>
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={state.tone} testId="job-state">
          {state.label}
        </ToneBadge>
        {health.labels.map((label) => (
          <ToneBadge key={label} tone={health.tone} testId="job-health">
            {label}
          </ToneBadge>
        ))}
        <span className="font-medium">{jobPurpose(job) ?? 'job'}</span>
        <span className="text-xs text-muted-foreground">{scopeSummary(job.scope)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Heartbeat</dt>
          <dd>{ago(ages.heartbeat)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last observation</dt>
          <dd data-testid="job-last-observation">{ago(ages.observation)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cadence</dt>
          <dd>{job.cadence ? `${job.cadence.intervalSeconds} s, pages of ${job.cadence.pageSize ?? 500}` : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Retries</dt>
          <dd>{job.retryCount}</dd>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <dt className="text-muted-foreground">Committed cursor</dt>
          <dd className="break-all font-mono" data-testid="job-cursor">{job.committedCursor ? JSON.stringify(job.committedCursor) : 'none yet'}</dd>
        </div>
        {pageOutcomes(job).length > 0 && (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-muted-foreground">Last page</dt>
            <dd>{pageOutcomes(job).map(([code, count]) => `${code} ${count}`).join(', ')}</dd>
          </div>
        )}
      </dl>
      {job.lastError && <p className="text-xs text-destructive">{job.lastError}</p>}
      <div className="flex flex-wrap gap-2">
        {allowedActions(job.state).map((next) => (
          <Button key={next} size="sm" variant={ACTION_TEXT[next].destructive ? 'destructive' : 'outline'} onClick={() => setAction(next)} data-testid={`job-${next}`}>
            {ACTION_TEXT[next].label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" aria-expanded={trail} onClick={() => setTrail(!trail)} data-testid="job-trail-toggle">
          Audit trail
        </Button>
      </div>
      {trail && <JobTransitions jobId={job.id} timezone={timezone} />}
      <JobCommandDialog job={job} action={action} onClose={() => setAction(null)} />
    </li>
  );
}
