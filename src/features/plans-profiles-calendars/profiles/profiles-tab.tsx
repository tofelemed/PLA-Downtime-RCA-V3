import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { ProfileView } from '@/api/v2/types/profiles';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { CAPACITY_MODEL_LABELS, labelOf } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { VersionStateBadge } from '../components/version-state-badge';
import { usePagedProfiles } from '../hooks/use-profile-reads';
import { usePlanningRefs, type PlanningRefs } from '../hooks/use-planning-refs';

function columnsOf(refs: PlanningRefs): DataTableColumn<ProfileView>[] {
  return [
    {
      id: 'key',
      header: 'Unit × product',
      cell: (p) => (
        <span className="font-medium" data-testid="profile-row" data-profile-id={p.id}>
          {refs.unitName(p.unitId)} × {refs.productName(p.productId)}
        </span>
      ),
    },
    { id: 'mode', header: 'Operating mode', cell: (p) => p.operatingMode },
    { id: 'version', header: 'Version', nowrap: true, cell: (p) => `Version ${p.version}` },
    { id: 'capacity', header: 'Capacity model', cell: (p) => labelOf(CAPACITY_MODEL_LABELS, p.capacityModel) },
    {
      id: 'effective',
      header: 'Effective',
      nowrap: true,
      cell: (p) => (
        <span className="text-xs">
          <PlantTime iso={p.effectiveFrom} tz={refs.timezone} withDate /> → {p.effectiveTo ? <PlantTime iso={p.effectiveTo} tz={refs.timezone} withDate /> : 'open-ended'}
        </span>
      ),
    },
    { id: 'state', header: 'State', cell: (p) => <VersionStateBadge state={p.state} /> },
  ];
}

/**
 * Production profiles: what a unit can make of a product, with effective-dated rates and valuation rates.
 * 20 per page; a row opens the profile at `/planning/profiles/:profileId`.
 */
export function ProfilesTab() {
  const { canWriteProfiles, canApproveProfiles } = useCapabilities();
  const refs = usePlanningRefs();
  const navigate = useNavigate();
  const [unitId, setUnitId] = useState('');
  const [productId, setProductId] = useState('');
  const profiles = usePagedProfiles({ unitId, productId });
  return (
    <div className="space-y-4" data-testid="profiles-tab">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <FormField id="profileUnitFilter" label="Unit">
            <NativeSelect id="profileUnitFilter" value={unitId} options={refs.unitOptions} placeholder="All units" onChange={setUnitId} />
          </FormField>
        </div>
        <div className="w-64">
          <FormField id="profileProductFilter" label="Product">
            <NativeSelect id="profileProductFilter" value={productId} options={refs.productOptions} placeholder="All products" onChange={setProductId} />
          </FormField>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ReadOnlyHint />
          {canApproveProfiles && (
            <Button asChild size="sm" variant="outline" data-testid="rate-import">
              <Link to="/planning/profiles/import">
                <ActionIcon.import className="h-4 w-4" aria-hidden="true" />
                Import rates
              </Link>
            </Button>
          )}
          {canWriteProfiles && (
            <Button asChild size="sm" data-testid="profile-new">
              <Link to="/planning/profiles/new">
                <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
                New profile
              </Link>
            </Button>
          )}
        </div>
      </div>
      <DataTable
        caption="Production profiles"
        columns={columnsOf(refs)}
        rows={profiles.rows}
        getRowKey={(p) => p.id}
        pager={profiles.pager}
        status={profiles.status}
        empty={{ title: 'No profiles', text: 'No profiles match these filters.' }}
        onRowClick={(p) => navigate(`/planning/profiles/${p.id}`)}
        rowLabel={(p) => `Open profile ${refs.unitName(p.unitId)} × ${refs.productName(p.productId)}`}
      />
    </div>
  );
}
