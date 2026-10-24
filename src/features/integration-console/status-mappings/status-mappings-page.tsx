import { useState } from 'react';
import { useStatusMappings } from '@/api/v2/queries/status-mappings';
import type { SourceStatusMappingView } from '@/api/v2/types/status-mappings';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { AddDialog } from '@/features/ux-kit/add-dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { StatusIcon } from '@/lib/icons';
import { IntegrationCard } from '../components/integration-card';
import { CONSOLE_PATH } from '../paths';
import { MappingDraftForm } from './mapping-draft-form';
import { MappingVersionCard } from './mapping-version-card';
import { groupBySource } from './status-mapping-form';

/** `null` = closed, `'new'` = a new source, else the source's newest version a new version starts from. */
type Draft = null | 'new' | SourceStatusMappingView;

const PAGE_INFO =
  'Which status of each source system marks its released (authorised final) record. Imports use the approved version in force when the record arrives; a later version never re-evaluates stored records. Production accounting approves as the source owner, never the author.';

const sourceTitle = (sourceSystem: string) => (sourceSystem === 'import' ? 'import (API and file imports)' : sourceSystem);

function SourceGroup({ sourceSystem, versions, timezone, onNewVersion }: { sourceSystem: string; versions: SourceStatusMappingView[]; timezone: string; onNewVersion: (() => void) | null }) {
  const action = onNewVersion && (
    <Button size="sm" variant="outline" onClick={onNewVersion} data-testid={`mapping-new-version-${sourceSystem}`}>
      New version
    </Button>
  );
  return (
    <IntegrationCard title={sourceTitle(sourceSystem)} actions={action}>
      <div className="space-y-2" data-testid="mapping-source-group" data-source={sourceSystem}>
        {versions.map((v) => (
          <MappingVersionCard key={v.id} version={v} timezone={timezone} />
        ))}
      </div>
    </IntegrationCard>
  );
}

/** No source has rules yet: a centred empty state, not a sentence under the title. */
function NoSources() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-10 text-center" data-testid="mapping-empty">
      <StatusIcon.empty aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
      <p className="font-medium">No source status rules yet</p>
      <p className="text-sm text-muted-foreground">Without an approved version a source releases nothing.</p>
    </div>
  );
}

function StatusMappingsScreen() {
  const query = useStatusMappings();
  const { timezone } = usePlantTimezone();
  const { canWriteStatusMappings } = useCapabilities();
  const [draft, setDraft] = useState<Draft>(null);
  const groups = groupBySource(query.data?.items ?? []);
  const newSource = canWriteStatusMappings && (
    <Button size="sm" onClick={() => setDraft('new')} data-testid="mapping-new-source">
      New source
    </Button>
  );
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="status-mappings">
        <PageHeader title="Source status rules" back={{ to: CONSOLE_PATH, label: 'Connectivity' }} titleAside={<KpiInfo label="Source status rules" text={PAGE_INFO} />} actions={newSource} />
        <AddDialog
          open={draft !== null}
          onOpenChange={(open) => !open && setDraft(null)}
          title={draft === null || draft === 'new' ? 'New source' : `New version of ${sourceTitle(draft.sourceSystem)}`}
          testId="mapping-draft-dialog"
        >
          {draft !== null && <MappingDraftForm key={draft === 'new' ? 'new' : draft.id} basis={draft === 'new' ? null : draft} timezone={timezone} onDone={() => setDraft(null)} />}
        </AddDialog>
        <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
          {groups.length === 0 && <NoSources />}
          {groups.map((g) => (
            <SourceGroup key={g.sourceSystem} sourceSystem={g.sourceSystem} versions={g.versions} timezone={timezone} onNewVersion={canWriteStatusMappings ? () => setDraft(g.versions[0]) : null} />
          ))}
        </DataState>
      </div>
    </Page>
  );
}

/**
 * Source status mappings (SME R13, EXPERT_REVIEW Area 3) at `/connectivity/source-status`: versions per source
 * system, their released / not released rules, effective dates, author and approver, and the version in force.
 * Every rule — roles, separation of duties, overlaps, which version is in force — is the server's.
 */
export function StatusMappingsPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its source status rules." />;
  return <StatusMappingsScreen />;
}
