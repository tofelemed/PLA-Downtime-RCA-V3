import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLotDispositions } from '@/api/v2/queries/lot-dispositions';
import { useProductionPeriod } from '@/api/v2/queries/production-periods';
import type { LotDispositionView } from '@/api/v2/types/periods';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DISPOSITION_CLASS_LABELS, DISPOSITION_STATE_LABELS } from '@/features/ux-kit/disposition-labels';
import { labelOf, useProductNames, useUserNames, type NameResolver } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { ActionIcon } from '@/lib/icons';
import { DispositionActions } from './disposition-actions';

export interface DispositionsSectionProps {
  planId: string;
  periodId: string;
  timezone: string;
}

function columnsOf(names: { products: NameResolver; users: NameResolver }, timezone: string, canDecide: boolean): DataTableColumn<LotDispositionView>[] {
  const columns: DataTableColumn<LotDispositionView>[] = [
    { id: 'lot', header: 'Lot', cell: (d) => <span data-testid="disposition-row" data-state={d.state} data-class={d.dispositionClass}>{d.lotCode}</span> },
    { id: 'product', header: 'Product', cell: (d) => names.products.nameOf(d.productId) },
    { id: 'class', header: 'Disposition', cell: (d) => labelOf(DISPOSITION_CLASS_LABELS, d.dispositionClass) },
    { id: 'quantity', header: 'Quantity', align: 'right', nowrap: true, cell: (d) => <Quantity value={d.quantity} uom={d.uom} /> },
    { id: 'produced', header: 'Produced', nowrap: true, cell: (d) => <><PlantTime iso={d.productionStart} tz={timezone} withDate /> → <PlantTime iso={d.productionEnd} tz={timezone} /></> },
    { id: 'evidence', header: 'Evidence', cell: (d) => d.evidenceRef ?? '—' },
    { id: 'author', header: 'Recorded by', cell: (d) => names.users.nameOf(d.authorId) },
    { id: 'state', header: 'State', cell: (d) => labelOf(DISPOSITION_STATE_LABELS, d.state) },
  ];
  if (!canDecide) return columns;
  return [...columns, { id: 'actions', header: 'Decision', cell: (d) => (d.state === 'proposed' ? <DispositionActions disposition={d} /> : '—') }];
}

/**
 * SME E3: what became of the product made in this period — intentional wide-spec, downgrade, transition
 * off-grade, scrap, rework — and reprocessed material recovered in it. Approved rows classify the period
 * actuals (first-pass good never includes recovered material); rejected and corrected rows stay listed.
 */
export function DispositionsSection({ planId, periodId, timezone }: DispositionsSectionProps) {
  const { canWriteDispositions, canApproveDispositions } = useCapabilities();
  const period = useProductionPeriod(periodId);
  const detail = period.data?.data;
  const list = useLotDispositions(detail ? { unitId: detail.unitId, from: detail.utcStart, to: detail.utcEnd } : null);
  const names = { products: useProductNames(), users: useUserNames() };
  const record = canWriteDispositions && (
    <Button asChild size="sm" variant="outline" data-testid="disposition-record">
      <Link to={`/plans/${planId}/periods/${periodId}/dispositions/new`}>
        <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
        Record disposition
      </Link>
    </Button>
  );
  return (
    <Section title="Product dispositions" headingLevel={3} actions={record || undefined} description="Lab and quality decisions on the lots made in this period; they count once a Quality / Lab approver approves them.">
      <div data-testid="dispositions">
        <DataTable
          caption="Product dispositions"
          columns={columnsOf(names, timezone, canApproveDispositions)}
          rows={list.data?.items ?? []}
          getRowKey={(d) => d.id}
          status={{ isLoading: list.isLoading, isError: list.isError, error: list.error }}
          empty={{ text: 'No dispositions recorded for this period.' }}
          density="compact"
        />
      </div>
    </Section>
  );
}
