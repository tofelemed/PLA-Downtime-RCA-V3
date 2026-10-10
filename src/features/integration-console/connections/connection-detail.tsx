import { useState } from 'react';
import { useIngestionJobs } from '@/api/v2/queries/ingestion-jobs';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DiscoveryPanel } from '../discovery/discovery-panel';
import type { ConsoleSession } from '../hooks/use-console-session';
import { useConnectionStages } from '../hooks/use-connection-stages';
import { JobsPanel } from '../jobs/jobs-panel';
import { EMPTY_SCOPE, type SourceScope } from '../model/discovery';
import { isSourceSupported } from '../model/source-types';
import { SignalsPanel } from '../signals/signals-panel';
import { ConnectionHeader } from './connection-header';
import { DiagnosticsPanel } from './diagnostics-panel';
import { StageTracker } from './stage-tracker';

export interface ConnectionDetailProps {
  connection: ConnectionView;
  session: ConsoleSession;
  timezone: string;
  onEdit: () => void;
}

/**
 * One connection end to end (UX06): stages, staged diagnostics, discovery and mapping, jobs with replay,
 * signals. The scope chosen under Discovery is the scope new jobs read.
 */
export function ConnectionDetail({ connection, session, timezone, onEdit }: ConnectionDetailProps) {
  const [tab, setTab] = useState('stages');
  const [scope, setScope] = useState<SourceScope>(EMPTY_SCOPE);
  const jobs = useIngestionJobs(connection.id);
  const stages = useConnectionStages(connection, jobs.items, session);
  const supported = isSourceSupported(connection.sourceType);
  return (
    <section aria-label={connection.displayName} className="space-y-4" data-testid="connection-detail" data-connection-id={connection.id}>
      <ConnectionHeader connection={connection} onEdit={onEdit} />
      {!supported ? (
        <p className="text-sm text-muted-foreground">No adapter for this source type is installed yet; it cannot be tested or run from the console.</p>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="stages">Stages</TabsTrigger>
            <TabsTrigger value="diagnostics" data-testid="tab-diagnostics">Diagnostics</TabsTrigger>
            <TabsTrigger value="discovery" data-testid="tab-discovery">Discovery and mapping</TabsTrigger>
            <TabsTrigger value="jobs" data-testid="tab-jobs">Jobs and replay</TabsTrigger>
            <TabsTrigger value="signals">Signals</TabsTrigger>
          </TabsList>
          <TabsContent value="stages">
            <StageTracker stages={stages} timezone={timezone} />
          </TabsContent>
          <TabsContent value="diagnostics">
            <DiagnosticsPanel connection={connection} last={session.testOf(connection.id)} timezone={timezone} onTested={(result) => session.recordTest(connection.id, result)} />
          </TabsContent>
          <TabsContent value="discovery" forceMount hidden={tab !== 'discovery'}>
            <DiscoveryPanel connectionId={connection.id} scope={scope} timezone={timezone} onScope={setScope} onSampled={() => session.recordSample(connection.id)} />
          </TabsContent>
          <TabsContent value="jobs">
            <JobsPanel connectionId={connection.id} scope={scope} timezone={timezone} jobs={jobs} />
          </TabsContent>
          <TabsContent value="signals">
            <SignalsPanel connectionId={connection.id} />
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}
