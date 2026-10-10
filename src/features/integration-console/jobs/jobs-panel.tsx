import { useEffect, useState } from 'react';
import { JOB_POLL_MS } from '@/api/v2/queries/ingestion-jobs';
import type { IngestionJobView } from '@/api/v2/types/integrations';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import type { SourceScope } from '../model/discovery';
import { JobCreateForm } from './job-create-form';
import { JobRow } from './job-row';
import { ReplayWizard } from './replay-wizard';

export interface JobsPanelProps {
  connectionId: string;
  scope: SourceScope;
  timezone: string;
  jobs: {
    items: IngestionJobView[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
  };
}

/** Wall clock for age badges, ticking with the job poll (ages are display only). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), JOB_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Durable ingestion jobs of a connection (ING02): several per connection, real start / pause / resume /
 * drain / stop with confirmation and audit trail, live lease / heartbeat / cursor / health from the
 * server; plus the bounded replay wizard.
 */
export function JobsPanel({ connectionId, scope, timezone, jobs }: JobsPanelProps) {
  const now = useNow();
  return (
    <section aria-label="Jobs" className="space-y-4" data-testid="jobs-panel">
      <JobCreateForm connectionId={connectionId} scope={scope} />
      <DataState state={dataStateOf(jobs, { isEmpty: jobs.items.length === 0 })} error={jobs.error} detail={jobs.items.length === 0 ? 'No job yet for this connection.' : undefined}>
        <ul className="space-y-2">
          {jobs.items.map((job) => (
            <JobRow key={job.id} job={job} timezone={timezone} now={now} />
          ))}
        </ul>
      </DataState>
      <ReplayWizard connectionId={connectionId} />
    </section>
  );
}
