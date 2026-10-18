import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSourceAuthorityInForce, useSourceAuthorityVersions } from '@/api/v2/queries/source-authority';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { CONSOLE_PATH } from '../paths';
import { HierarchyEditor } from './hierarchy-editor';
import { PolicySources, VersionCard } from './version-card';

function InForce({ unitId, timezone }: { unitId: string; timezone: string }) {
  const current = useSourceAuthorityInForce(unitId);
  return (
    <Section title="In force now" headingLevel={2}>
      <DataState state={dataStateOf(current)} error={current.error} onRetry={() => void current.refetch()}>
        {current.data && (
          <div className="space-y-1 text-sm" data-testid="authority-in-force">
            <p className="text-muted-foreground">
              Version {current.data.version} {current.data.unitId ? 'of this unit' : '(plant-wide)'} since <PlantTime iso={current.data.effectiveFrom} tz={timezone} withDate />
            </p>
            <PolicySources policy={current.data.policy} />
          </div>
        )}
      </DataState>
    </Section>
  );
}

function UnitVersions({ unitId, timezone }: { unitId: string; timezone: string }) {
  const versions = useSourceAuthorityVersions(unitId);
  const items = versions.data?.items ?? [];
  return (
    <Section title="Versions of this unit and of the whole plant" headingLevel={2}>
      <DataState state={dataStateOf(versions)} error={versions.error} onRetry={() => void versions.refetch()}>
        {items.length === 0 && <p className="text-sm text-muted-foreground">No version yet; the plant default applies.</p>}
        <div className="space-y-3" data-testid="authority-versions">
          {items.map((version) => (
            <VersionCard key={version.id} version={version} timezone={timezone} />
          ))}
        </div>
      </DataState>
    </Section>
  );
}

function SourceAuthorityScreen() {
  const units = useUnits();
  const unitOptions = flattenPages(units.data?.pages).map((unit) => ({ value: unit.id, label: unit.name }));
  const [params, setParams] = useSearchParams();
  const unitId = params.get('unitId') ?? '';
  const setUnitId = (id: string) => setParams((current) => { const next = new URLSearchParams(current); next.set('unitId', id); return next; });
  const [drafting, setDrafting] = useState(false);
  const { timezone } = usePlantTimezone();
  const { canWriteSourceAuthority } = useCapabilities();
  const chosen = unitId || unitOptions[0]?.value || '';
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="source-authority">
        <PageHeader
          title="Source priority"
          back={{ to: CONSOLE_PATH, label: 'Connectivity' }}
          description="Which measurement source counts for a unit's output, best first. A new version is a draft by the integration owner or production accounting; it applies only once production accounting approves it, SuperAdmin may approve their own version. Periods already calculated keep their version until they are recalculated."
          actions={
            canWriteSourceAuthority &&
            chosen && (
              <Button size="sm" onClick={() => setDrafting(true)} data-testid="authority-new">
                New version
              </Button>
            )
          }
        />
        <div className="max-w-sm space-y-1">
          <Label htmlFor="authority-unit">Unit</Label>
          <NativeSelect id="authority-unit" testId="authority-unit" value={chosen} onChange={(v) => { setUnitId(v); setDrafting(false); }} options={unitOptions} />
        </div>
        {drafting && chosen && <HierarchyEditor key={chosen} unitId={chosen} onDone={() => setDrafting(false)} />}
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
 * own and the plant-wide versions, a hierarchy editor for new drafts and the drafts waiting for production accounting (owner, 15 Oct 2026: maker-checker). Every
 * rule — roles, separation of duties, stale drafts, which version is in force — is the server's.
 */
export function SourceAuthorityPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its source priority." />;
  return <SourceAuthorityScreen />;
}
