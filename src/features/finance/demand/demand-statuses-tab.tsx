import { useDemandStatuses } from '@/api/v2/queries/demand-statuses';
import type { DemandStatusView } from '@/api/v2/types/valuation';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DEMAND_STATUS_LABELS, labelOf } from '@/features/ux-kit/labels';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { TableCard } from '@/features/plans-profiles-calendars/components/table-card';
import { DemandActions } from './demand-actions';
import { useProductName } from './use-product-name';
import { FocusedListNotice } from '@/features/ux-kit/focused-list-notice';
import { useAnchorFocus } from '@/features/ux-kit/use-anchor-focus';
import { infiniteListState, useSeekAnchor } from '@/features/ux-kit/use-seek-anchor';

const DEMAND_INFO =
  'Lost output counts as a lost sale only where an approved status says the product was sold out; elsewhere the economic view shows the tonnes with no lost-sales value.';

/**
 * Demand statuses of the plant's products (SME V3): lost output counts as a lost sale only where an
 * approved status says the product was sold out; elsewhere the economic view shows the tonnes with no
 * lost-sales value, and without any status it stays unvalued. All of it is decided on the server.
 */
export function DemandStatusesTab() {
  const dates = usePlantDates();
  const anchor = useAnchorFocus('demand-status-');
  const statuses = useDemandStatuses({ focus: anchor.focus });
  useSeekAnchor(anchor, infiniteListState(statuses.query));
  const productName = useProductName();
  const columns: Array<DataTableColumn<DemandStatusView>> = [
    { id: 'product', header: 'Product', cell: (s) => <span data-testid="demand-row">{productName(s.productId)}</span> },
    { id: 'status', header: 'Demand', cell: (s) => labelOf(DEMAND_STATUS_LABELS, s.status) },
    { id: 'valid', header: 'Valid', nowrap: true, cell: (s) => dates.validity(s.effectiveFrom, s.effectiveTo) },
    { id: 'evidence', header: 'Evidence', cell: (s) => s.evidence },
    { id: 'state', header: 'State', nowrap: true, cell: (s) => <VersionStateBadge state={s.state} /> },
    { id: 'actions', header: 'Actions', nowrap: true, cell: (s) => <DemandActions status={s} /> },
  ];
  return (
    <div className="space-y-4" data-testid="demand-statuses-tab">
      <FocusedListNotice anchor={anchor} what="demand statuses" />
      <TableCard title="Demand statuses" info={DEMAND_INFO}>
        <DataTable
          caption="Demand statuses"
          columns={columns}
          rows={statuses.rows}
          getRowKey={(s) => s.id}
          getRowAnchor={(s) => `demand-status-${s.id}`}
          pager={statuses.pager}
          status={statuses.status}
          empty={{ title: 'No demand statuses', text: 'Without an approved status, the economic view of lost output stays unvalued.' }}
        />
      </TableCard>
    </div>
  );
}
