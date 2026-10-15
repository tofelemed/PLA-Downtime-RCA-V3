import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useProductionPeriod } from '@/api/v2/queries/production-periods';
import type { PeriodAdjustmentView, PeriodDetailView } from '@/api/v2/types/periods';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf, useProductNames, useUserNames, type NameResolver } from '@/features/ux-kit/labels';
import { Section } from '@/features/ux-kit/page-layout';
import { Quantity } from '@/features/ux-kit/quantity';
import { ActionIcon } from '@/lib/icons';
import { ADJUSTMENT_BASIS_LABELS, ADJUSTMENT_KIND_LABELS, ADJUSTMENT_STATE_LABELS } from '../model/actuals-labels';
import { AdjustmentActions } from './adjustment-actions';

export interface AdjustmentsSectionProps {
  planId: string;
  periodId: string;
}

interface Names {
  products: NameResolver;
  users: NameResolver;
  productOf: (sliceId: string) => string | null;
}

function columnsOf(names: Names, canDecide: boolean): DataTableColumn<PeriodAdjustmentView>[] {
  const columns: DataTableColumn<PeriodAdjustmentView>[] = [
    { id: 'product', header: 'Product', cell: (a) => <span data-testid="adjustment-row" data-state={a.state}>{names.products.nameOf(names.productOf(a.sliceId))}</span> },
    { id: 'kind', header: 'Corrects', cell: (a) => labelOf(ADJUSTMENT_KIND_LABELS, a.kind) },
    { id: 'quantity', header: 'Change', align: 'right', nowrap: true, cell: (a) => <Quantity value={a.quantity} uom={a.uom} /> },
    { id: 'basis', header: 'Basis', cell: (a) => labelOf(ADJUSTMENT_BASIS_LABELS, a.basis) },
    { id: 'reason', header: 'Reason', cell: (a) => a.reason },
    { id: 'evidence', header: 'Evidence', cell: (a) => a.evidenceRef },
    { id: 'author', header: 'Proposed by', cell: (a) => names.users.nameOf(a.authorId) },
    { id: 'state', header: 'State', cell: (a) => labelOf(ADJUSTMENT_STATE_LABELS, a.state) },
  ];
  if (!canDecide) return columns;
  return [...columns, { id: 'actions', header: 'Decision', cell: (a) => (a.state === 'proposed' ? <AdjustmentActions adjustment={a} /> : '—') }];
}

const productOfSlice = (detail: PeriodDetailView | undefined) => (sliceId: string) => detail?.slices.find((s) => s.id === sliceId)?.productId ?? null;

/**
 * Governed corrections of the period's actuals (weighbridge recount, lab result): engineers propose them
 * with a reason and evidence, a manager approver who is not the author approves (the period is then
 * recalculated) or rejects them with a reason.
 */
export function AdjustmentsSection({ planId, periodId }: AdjustmentsSectionProps) {
  const { canWritePeriods, canApproveAdjustments } = useCapabilities();
  const period = useProductionPeriod(periodId);
  const products = useProductNames();
  const users = useUserNames();
  const detail = period.data?.data;
  const propose = canWritePeriods && (
    <Button asChild size="sm" variant="outline" data-testid="adjustment-propose">
      <Link to={`/plans/${planId}/periods/${periodId}/adjustments/new`}>
        <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
        Propose adjustment
      </Link>
    </Button>
  );
  return (
    <Section title="Actuals adjustments" headingLevel={3} actions={propose || undefined} description="Corrections of the measured output; they count once a manager approver approves them.">
      <div data-testid="adjustments">
        <DataTable
          caption="Actuals adjustments"
          columns={columnsOf({ products, users, productOf: productOfSlice(detail) }, canApproveAdjustments)}
          rows={detail?.adjustments ?? []}
          getRowKey={(a) => a.id}
          status={{ isLoading: period.isLoading, isError: period.isError, error: period.error }}
          empty={{ text: 'No adjustments for this period.' }}
          density="compact"
        />
      </div>
    </Section>
  );
}
