import type { IngestionJobView } from '@/api/v2/types/integrations';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ListPager, useClientPager } from '@/features/ux-kit/data-table';
import { Section } from '@/features/ux-kit/page-layout';
import { IntegrationCard } from '../components/integration-card';
import { useJobClock } from '../hooks/use-job-clock';
import type { SourceScope } from '../model/discovery';
import { JobCreateForm } from './job-create-form';
import { JobRow } from './job-row';
import { ReplayWizard } from './replay-wizard';

const JOBS_INFO = 'Durable ingestion jobs of this connection with their live lease, heartbeat, cursor and health from the server. Start, pause, resume, drain and stop ask for a reason kept in the audit trail.';

export interface JobsPanelProps {
  connectionId: string;
  scope: SourceScope;
  timezone: string;
  /** choose the scope here when none is chosen under Discovery yet */
  onScope: (scope: SourceScope) => void;
  jobs: {
    items: IngestionJobView[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
  };
}

/**
 * Durable ingestion jobs of a connection (ING02): several per connection, real start / pause / resume /
 * drain / stop with confirmation and audit trail, live lease / heartbeat / cursor / health from the
 * server (20 per page); plus the bounded replay.
 */
export function JobsPanel({ connectionId, scope, timezone, jobs, onScope }: JobsPanelProps) {
  const { canWriteIntegration } = useCapabilities();
  const now = useJobClock(jobs.items.map((job) => job.state));
  const paged = useClientPager(jobs.items);
  return (
    <div className="space-y-6" data-testid="jobs-panel">
      {canWriteIntegration && (
        <Section title="New job" headingLevel={3}>
          <JobCreateForm connectionId={connectionId} scope={scope} onScope={onScope} />
        </Section>
      )}
      <IntegrationCard title="Jobs" info={JOBS_INFO}>
        <DataState state={dataStateOf(jobs, { isEmpty: jobs.items.length === 0 })} error={jobs.error} detail={jobs.items.length === 0 ? 'No job yet for this connection.' : undefined}>
          <ul className="space-y-2" aria-label="Jobs">
            {paged.rows.map((job) => (
              <JobRow key={job.id} job={job} timezone={timezone} now={now} />
            ))}
          </ul>
          <ListPager pager={paged.pager} label="Job pages" />
        </DataState>
      </IntegrationCard>
      {canWriteIntegration && <ReplayWizard connectionId={connectionId} timezone={timezone} />}
    </div>
  );
}
