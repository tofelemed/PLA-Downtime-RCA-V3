import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSourceAuthorityInForce, useSourceAuthorityVersions } from '@/api/v2/queries/source-authority';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { EditorSheet } from '@/features/ux-kit/editor-sheet';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { selfApprovalNote } from '@/features/ux-kit/format/self-approval-note';
import { StatusIcon } from '@/lib/icons';
import { FilterField } from '../components/filter-field';
import { IntegrationCard } from '../components/integration-card';
import { EffectiveFromText } from '../components/plant-instant';
import { CONSOLE_PATH } from '../paths';
import { HierarchyEditor } from './hierarchy-editor';
import { PolicySources, VersionCard } from './version-card';

const pageInfo = (isSuperAdmin: boolean) =>
  `Which measurement source counts for a unit's output, best first. A new version is a draft by the integration owner or production accounting; it applies only once production accounting approves it.${selfApprovalNote(isSuperAdmin, 'version')} Periods already calculated keep their version until they are recalculated.`;

function InForce({ unitId, timezone }: { unitId: string; timezone: string }) {
  const current = useSourceAuthorityInForce(unitId);
  return (
    <IntegrationCard title="In force now">
      <DataState state={dataStateOf(current)} error={current.error} onRetry={() => void current.refetch()}>
        {current.data && (
          <div className="space-y-1 text-sm" data-testid="authority-in-force">
            <p className="text-muted-foreground">
              Version {current.data.version} {current.data.unitId ? 'of this unit' : '(plant-wide)'} · <EffectiveFromText iso={current.data.effectiveFrom} tz={timezone} prefix="since" />
            </p>
            <PolicySources policy={current.data.policy} />
          </div>
        )}
      </DataState>
    </IntegrationCard>
  );
}

function NoVersions() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border px-4 py-10 text-center" data-testid="authority-empty">
      <StatusIcon.empty aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
      <p className="font-medium">No version yet</p>
      <p className="text-sm text-muted-foreground">The plant default applies.</p>
    </div>
  );
}

function UnitVersions({ unitId, timezone }: { unitId: string; timezone: string }) {
  const versions = useSourceAuthorityVersions(unitId);
  const items = versions.data?.items ?? [];
  return (
    <IntegrationCard title="Versions of this unit and of the whole plant">
      <DataState state={dataStateOf(versions)} error={versions.error} onRetry={() => void versions.refetch()}>
        {items.length === 0 && <NoVersions />}
        <div className="space-y-3" data-testid="authority-versions">
          {items.map((version) => (
            <VersionCard key={version.id} version={version} timezone={timezone} />
          ))}
        </div>
      </DataState>
    </IntegrationCard>
  );
}

function useChosenUnit() {
  const units = useUnits();
  const unitOptions = flattenPages(units.data?.pages).map((unit) => ({ value: unit.id, label: unit.name }));
  const [params, setParams] = useSearchParams();
  const setUnitId = (id: string) => setParams((current) => { const next = new URLSearchParams(current); next.set('unitId', id); return next; });
  const chosen = params.get('unitId') || unitOptions[0]?.value || '';
  return { units, unitOptions, chosen, setUnitId };
}

function SourceAuthorityScreen() {
  const { units, unitOptions, chosen, setUnitId } = useChosenUnit();
  const [drafting, setDrafting] = useState(false);
  const { timezone } = usePlantTimezone();
  const { canWriteSourceAuthority, isSuperAdmin } = useCapabilities();
  const newVersion = canWriteSourceAuthority && chosen && (
    <Button size="sm" onClick={() => setDrafting(true)} data-testid="authority-new">
      New version
    </Button>
  );
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="source-authority">
        <PageHeader title="Source priority" back={{ to: CONSOLE_PATH, label: 'Connectivity' }} titleAside={<KpiInfo label="Source priority" text={pageInfo(isSuperAdmin)} />} actions={newVersion} />
        <div className="flex flex-wrap items-end gap-3">
          <FilterField id="authority-unit" label="Unit" className="w-full sm:w-72">
            <NativeSelect id="authority-unit" testId="authority-unit" value={chosen} onChange={(v) => { setUnitId(v); setDrafting(false); }} options={unitOptions} />
          </FilterField>
        </div>
        <EditorSheet open={drafting && Boolean(chosen)} onOpenChange={setDrafting} title="New source priority version" description="Saved as a draft; it applies once production accounting approves it.">
          {chosen && <HierarchyEditor key={chosen} unitId={chosen} onDone={() => setDrafting(false)} />}
        </EditorSheet>
        {chosen ? (
          <>
            <InForce unitId={chosen} timezone={timezone} />
            <UnitVersions unitId={chosen} timezone={timezone} />
          </>
        ) : (
          <DataState state={dataStateOf(units)} error={units.error} />
        )}
      </div>
    </Page>
  );
}

/**
 * Source authority (D05 / SME E7) at `/connectivity/source-authority`: the version in force for a unit, its
 * own and the plant-wide versions, a hierarchy editor (side panel) for new drafts and the drafts waiting for production accounting (owner, 15 Oct 2026: maker-checker). Every
 * rule — roles, separation of duties, stale drafts, which version is in force — is the server's.
 */
export function SourceAuthorityPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its source priority." />;
  return <SourceAuthorityScreen />;
}
