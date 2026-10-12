import { Link } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { ActionIcon } from '@/lib/icons';
import { ConnectionsList } from '../connections/connections-list';
import { useUrlParam } from '../hooks/use-url-param';
import { SourceMappingsTab } from '../mapping/source-mappings-tab';
import { NEW_CONNECTION_PATH, type ConsoleTab } from '../paths';
import { QuarantineInbox } from '../quarantine/quarantine-inbox';

const TABS: readonly ConsoleTab[] = ['connections', 'quarantine', 'mappings'];

function NewConnectionAction() {
  const { canWriteIntegration } = useCapabilities();
  if (!canWriteIntegration) return <ReadOnlyHint />;
  return (
    <Button asChild size="sm">
      <Link to={NEW_CONNECTION_PATH} data-testid="new-connection">
        <ActionIcon.add className="mr-1 h-4 w-4" aria-hidden="true" /> New connection
      </Link>
    </Button>
  );
}

/**
 * Connectivity (integration console, UX06): connections with staged diagnostics, discovery and typed
 * mapping preview, durable jobs, quarantine and bounded replay, and the source → plant mapping rules.
 * The tab is in the URL; each connection, quarantined item and mapping rule has its own page.
 */
export function ConsolePage() {
  const tenantId = useV2TenantId();
  const { timezone, source } = usePlantTimezone();
  const [tab, setTab] = useUrlParam('tab', TABS, 'connections');
  const zone = `Times in ${timezone}${source === 'utc-fallback' ? ' (no plant timezone configured)' : ''}.`;
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="integration-console">
        <PageHeader title="Connectivity" description={`Connections to plant sources, ingestion jobs, quarantine and mapping rules. ${zone}`} actions={tenantId ? <NewConnectionAction /> : undefined} />
        {!tenantId ? (
          <DataState state="no-permission" detail="Choose a plant (tenant) to manage its integrations." />
        ) : (
          <Tabs value={tab} onValueChange={(next) => setTab(next as ConsoleTab)}>
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="connections" data-testid="tab-connections">Connections</TabsTrigger>
              <TabsTrigger value="quarantine" data-testid="tab-quarantine">Quarantine</TabsTrigger>
              <TabsTrigger value="mappings" data-testid="tab-mappings">Source mappings</TabsTrigger>
            </TabsList>
            <TabsContent value="connections" className="mt-4">
              <ConnectionsList />
            </TabsContent>
            <TabsContent value="quarantine" className="mt-4">
              <QuarantineInbox timezone={timezone} />
            </TabsContent>
            <TabsContent value="mappings" className="mt-4">
              <SourceMappingsTab />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Page>
  );
}
