import { Suspense } from 'react';
import { useIngestionJobs } from '@/api/v2/queries/ingestion-jobs';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { DiscoveryPanel } from '../discovery/discovery-panel';
import { useConnectionStages } from '../hooks/use-connection-stages';
import { useConsoleSession } from '../hooks/use-console-session';
import { useSourceScope } from '../hooks/use-source-scope';
import { useUrlParam } from '../hooks/use-url-param';
import { JobsPanel } from '../jobs/jobs-panel';
import { isSourceSupported } from '../model/source-types';
import { LazyMqttConnectionPanel } from '../mqtt/mqtt-lazy';
import { SignalsPanel } from '../signals/signals-panel';
import { DiagnosticsPanel } from './diagnostics-panel';
import { StageTracker } from './stage-tracker';

export interface ConnectionDetailProps {
  connection: ConnectionView;
  timezone: string;
}

const PI_TABS = ['stages', 'diagnostics', 'discovery', 'jobs', 'signals'] as const;
type PiTab = (typeof PI_TABS)[number];

/**
 * One connection end to end (UX06) under its page header: stages, staged diagnostics, discovery and
 * mapping, jobs with replay, signals; the tab is in the URL. MQTT connections get the subscription
 * panel instead. Diagnostics and discovery are writer commands, so only writers see those tabs.
 */
export function ConnectionDetail({ connection, timezone }: ConnectionDetailProps) {
  if (connection.sourceType === 'mqtt') {
    return (
      <div data-testid="connection-detail" data-connection-id={connection.id} data-source-type="mqtt">
        <Suspense fallback={<DataState state="loading" />}>
          <LazyMqttConnectionPanel connection={connection} timezone={timezone} />
        </Suspense>
      </div>
    );
  }
  if (!isSourceSupported(connection.sourceType)) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="connection-detail" data-connection-id={connection.id}>
        No adapter for this source type is installed yet; it cannot be tested or run from here.
      </p>
    );
  }
  return <PiConnectionDetail connection={connection} timezone={timezone} />;
}

function PiConnectionDetail({ connection, timezone }: ConnectionDetailProps) {
  const { canWriteIntegration } = useCapabilities();
  const session = useConsoleSession();
  const [tab, setTab] = useUrlParam<PiTab>('tab', PI_TABS, 'stages');
  const [scope, setScope] = useSourceScope();
  const jobs = useIngestionJobs(connection.id);
  const stages = useConnectionStages(connection, jobs.items, session);
  return (
    <div data-testid="connection-detail" data-connection-id={connection.id}>
      <Tabs value={tab} onValueChange={(next) => setTab(next as PiTab)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="stages">Stages</TabsTrigger>
          {canWriteIntegration && <TabsTrigger value="diagnostics" data-testid="tab-diagnostics">Diagnostics</TabsTrigger>}
          {canWriteIntegration && <TabsTrigger value="discovery" data-testid="tab-discovery">Discovery and mapping</TabsTrigger>}
          <TabsTrigger value="jobs" data-testid="tab-jobs">Jobs and replay</TabsTrigger>
          <TabsTrigger value="signals" data-testid="tab-signals">Signals</TabsTrigger>
        </TabsList>
        <TabsContent value="stages" className="mt-4">
          <StageTracker stages={stages} timezone={timezone} />
        </TabsContent>
        <TabsContent value="diagnostics" className="mt-4">
          <DiagnosticsPanel connection={connection} last={session.testOf(connection.id)} timezone={timezone} onTested={(result) => session.recordTest(connection.id, result)} />
        </TabsContent>
        {/* kept mounted: the sample survives a look at the jobs (the scope itself is in the URL) */}
        <TabsContent value="discovery" className="mt-4" forceMount hidden={tab !== 'discovery'}>
          <DiscoveryPanel connectionId={connection.id} scope={scope} timezone={timezone} onScope={setScope} onSampled={() => session.recordSample(connection.id)} />
        </TabsContent>
        <TabsContent value="jobs" className="mt-4">
          <JobsPanel connectionId={connection.id} scope={scope} timezone={timezone} jobs={jobs} onScope={setScope} />
        </TabsContent>
        <TabsContent value="signals" className="mt-4">
          <SignalsPanel connectionId={connection.id} timezone={timezone} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
