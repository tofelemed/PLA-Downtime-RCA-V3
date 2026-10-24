import { useNavigate } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import type { ProfileView } from '@/api/v2/types/profiles';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { CAPACITY_MODEL_LABELS, labelOf } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { useCurrentAddress, withReturnTo } from '@/features/ux-kit/page-layout';
import { NativeSelect } from '../components/native-select';
import { TableCard } from '../components/table-card';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { usePagedProfiles } from '../hooks/use-profile-reads';
import { usePlanningRefs, type PlanningRefs } from '../hooks/use-planning-refs';
import { useSearchParam, useUnitParam } from '../hooks/use-unit-param';
import { operatingModeLabel } from '../model/plan-labels';

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
    { id: 'mode', header: 'Operating mode', cell: (p) => operatingModeLabel(p.operatingMode) },
    { id: 'version', header: 'Version', nowrap: true, cell: (p) => `Version ${p.version}` },
    { id: 'capacity', header: 'Capacity model', cell: (p) => labelOf(CAPACITY_MODEL_LABELS, p.capacityModel) },
    {
      id: 'effective',
      header: 'Effective',
      nowrap: true,
      cell: (p) => (
        <span className="text-xs">
          <PlantTime iso={p.effectiveFrom} tz={refs.timezone} withDate withZone={false} /> → {p.effectiveTo ? <PlantTime iso={p.effectiveTo} tz={refs.timezone} withDate withZone={false} /> : 'open-ended'}
        </span>
      ),
    },
    { id: 'state', header: 'State', nowrap: true, cell: (p) => <VersionStateBadge state={p.state} /> },
  ];
}

/**
 * Production profiles: what a unit can make of a product, with effective-dated rates and valuation rates.
 * 20 per page; a row opens the profile at `/planning/profiles/:profileId`. The unit and product filters are in
 * the URL and every sub-page link carries this address (`?back=`), so Back returns to the list as it was.
 * "Import rates" and "New profile" are beside the page title (`ProfilesHeaderActions`).
 */
export function ProfilesTab() {
  const refs = usePlanningRefs();
  const navigate = useNavigate();
  const [unitId, setUnitId] = useUnitParam();
  const [productId, setProductId] = useSearchParam('productId');
  const here = useCurrentAddress();
  const profiles = usePagedProfiles({ unitId, productId });
  return (
    <div className="space-y-4" data-testid="profiles-tab">
      <div className="flex flex-wrap items-end gap-3">
        <div className={`${FIELD_CLASS} w-64`}>
          <Label htmlFor="profileUnitFilter">Unit</Label>
          <NativeSelect id="profileUnitFilter" value={unitId} options={refs.unitOptions} placeholder="All units" onChange={setUnitId} />
        </div>
        <div className={`${FIELD_CLASS} w-64`}>
          <Label htmlFor="profileProductFilter">Product</Label>
          <NativeSelect id="profileProductFilter" value={productId} options={refs.productOptions} placeholder="All products" onChange={setProductId} />
        </div>
      </div>
      <TableCard title="Production profiles">
        <DataTable
          caption="Production profiles"
          columns={columnsOf(refs)}
          rows={profiles.rows}
          getRowKey={(p) => p.id}
          pager={profiles.pager}
          status={profiles.status}
          empty={{ title: 'No profiles', text: 'No profiles match these filters.' }}
          onRowClick={(p) => navigate(withReturnTo(`/planning/profiles/${p.id}`, here))}
          rowLabel={(p) => `Open profile ${refs.unitName(p.unitId)} × ${refs.productName(p.productId)}`}
        />
      </TableCard>
    </div>
  );
}
