import { useState } from 'react';
import type { IngestionJobView, JobAction } from '@/api/v2/types/integrations';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DurationText } from '@/features/ux-kit/duration-text';
import { INTAKE_OUTCOME_LABELS, JOB_PURPOSE_LABELS, labelOf } from '@/features/ux-kit/labels';
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

function JobFacts({ job, now }: { job: IngestionJobView; now: number }) {
  const ages = jobAges(job, now);
  const outcomes = pageOutcomes(job);
  return (
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
      {outcomes.length > 0 && (
        <div className="col-span-2 sm:col-span-4">
          <dt className="text-muted-foreground">Last page</dt>
          <dd>{outcomes.map(([code, count]) => `${labelOf(INTAKE_OUTCOME_LABELS, code)} ${count}`).join(', ')}</dd>
        </div>
      )}
    </dl>
  );
}

/** Technical detail for integration admins: what the job reads, its committed cursor and the adapter's last error. */
function JobDetails({ job }: { job: IngestionJobView }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">Details</summary>
      <dl className="mt-1 space-y-1">
        <div>
          <dt className="text-muted-foreground">Reads</dt>
          <dd className="break-all">{scopeSummary(job.scope)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Committed cursor</dt>
          <dd className="break-all font-mono" data-testid="job-cursor">{job.committedCursor ? JSON.stringify(job.committedCursor) : 'none yet'}</dd>
        </div>
        {job.lastError && (
          <div>
            <dt className="text-muted-foreground">Last error reported by the source</dt>
            <dd className="break-all">{job.lastError}</dd>
          </div>
        )}
      </dl>
    </details>
  );
}

/** One job: state, health badges, ages, last page outcomes, commands, audit trail; technical detail on demand. */
export function JobRow({ job, timezone, now }: JobRowProps) {
  const { canWriteIntegration } = useCapabilities();
  const [action, setAction] = useState<JobAction | null>(null);
  const [trail, setTrail] = useState(false);
  const state = JOB_STATE_DISPLAY[job.state];
  const health = jobHealth(job, now);
  const purpose = jobPurpose(job);
  return (
    <li className="space-y-2 rounded-md border p-3 text-sm" data-testid="job-row" data-job-id={job.id} data-state={job.state} data-purpose={purpose ?? 'other'}>
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={state.tone} testId="job-state">
          {state.label}
        </ToneBadge>
        {health.labels.filter((label) => label !== state.label).map((label) => (
          <ToneBadge key={label} tone={health.tone} testId="job-health">
            {label}
          </ToneBadge>
        ))}
        <span className="font-medium">{purpose ? labelOf(JOB_PURPOSE_LABELS, purpose) : 'Ingestion job'}</span>
      </div>
      <JobFacts job={job} now={now} />
      {job.lastError && <p className="text-xs text-destructive">The last run failed; see Details.</p>}
      <JobDetails job={job} />
      <div className="flex flex-wrap gap-2">
        {(canWriteIntegration ? allowedActions(job.state) : []).map((next) => (
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
