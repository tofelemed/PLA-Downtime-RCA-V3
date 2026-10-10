import { useState } from 'react';
import { useConnection } from '@/api/v2/queries/integration-connections';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { ConnectionDetail } from './connections/connection-detail';
import { ConnectionWizard } from './connections/connection-wizard';
import { ConnectionsList } from './connections/connections-list';
import { useConsoleSession } from './hooks/use-console-session';
import { SourceMappingsTab } from './mapping/source-mappings-tab';
import { QuarantineInbox } from './quarantine/quarantine-inbox';

/**
 * Integration console (plan 3.7, UX06) behind `v2.integrationConsole`: source-neutral connections with
 * staged diagnostics, discovery and typed mapping preview, durable jobs, quarantine and bounded replay —
 * each stage with its result, so "connected" is never mistaken for "accounting works".
 */
export function IntegrationConsolePage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to manage its integrations." />;
  return <ConsoleScreen />;
}

function ConsoleScreen() {
  const { timezone, source } = usePlantTimezone();
  const session = useConsoleSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [wizard, setWizard] = useState<{ connection: ConnectionView | null } | null>(null);
  const [tab, setTab] = useState('connections');
  const selected = useConnection(selectedId);
  const saved = (connection: ConnectionView) => {
    setWizard(null);
    setSelectedId(connection.id);
  };
  return (
    <div className="space-y-4" data-testid="integration-console">
      <header>
        <h1 className="text-2xl font-bold">Integration console</h1>
        <p className="text-sm text-muted-foreground">
          Connections, discovery and mapping, ingestion jobs, quarantine and replay. Times in {timezone}
          {source === 'utc-fallback' ? ' (no plant timezone configured)' : ''}.
        </p>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="connections" data-testid="tab-connections">Connections</TabsTrigger>
          <TabsTrigger value="quarantine" data-testid="tab-quarantine">Quarantine</TabsTrigger>
          <TabsTrigger value="mappings" data-testid="tab-mappings">Source mappings</TabsTrigger>
        </TabsList>
        {/* kept mounted: the chosen scope and open panels survive a look at the quarantine */}
        <TabsContent value="connections" forceMount hidden={tab !== 'connections'}>
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <ConnectionsList
              selectedId={selectedId}
              includeInactive={includeInactive}
              onIncludeInactive={setIncludeInactive}
              onSelect={(connection) => setSelectedId(connection.id)}
              onCreate={() => setWizard({ connection: null })}
            />
            {selected.data ? (
              <ConnectionDetail key={selected.data.id} connection={selected.data} session={session} timezone={timezone} onEdit={() => setWizard({ connection: selected.data ?? null })} />
            ) : selectedId ? (
              <DataState state={selected.isError ? 'error' : 'loading'} error={selected.error} />
            ) : (
              <p className="text-sm text-muted-foreground">Select a connection or create one.</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="quarantine">
          <QuarantineInbox timezone={timezone} />
        </TabsContent>
        <TabsContent value="mappings">
          <SourceMappingsTab />
        </TabsContent>
      </Tabs>
      <ConnectionWizard open={wizard !== null} connection={wizard?.connection ?? null} onClose={() => setWizard(null)} onSaved={saved} />
    </div>
  );
}
