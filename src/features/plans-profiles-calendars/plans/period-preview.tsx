import { Badge } from '@/components/ui/badge';
import type { PlanPeriodView, PlanPreviewView } from '@/api/v2/types/plans';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { DISTRIBUTION_LABELS, labelOf } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { StatusIcon } from '@/lib/icons';
import { PERIOD_EXCLUSION_LABELS, PLAN_WARNING_LABELS } from '../model/plan-labels';
import { sumMatchesHeader } from '../model/plan-form';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface PeriodPreviewProps {
  preview: PlanPreviewView;
  /** the version's entered header target (quantity basis), for the Σ indicator */
  headerTarget: string | null;
  timezone: string;
  productName: (id: string | null | undefined) => string;
}

/** Σ of the server totals against the header target — "= header" or "≠ header" in words, not colour only. */
function SumBadge({ preview, headerTarget }: { preview: PlanPreviewView; headerTarget: string | null }) {
  const { text } = useNumberFormat();
  const matches = sumMatchesHeader(preview.totals, headerTarget);
  const totals = preview.totals.map((total) => `${text(total.target)} ${total.quantityUom ?? '(unit unknown)'}`).join(' · ');
  if (matches === null) return <Badge variant="outline" data-testid="sum-badge" data-match="n/a">Σ {totals || '—'}</Badge>;
  const Icon = matches ? StatusIcon.success : StatusIcon.error;
  return (
    <Badge className={matches ? 'bg-green-600 text-white' : 'bg-red-600 text-white'} data-testid="sum-badge" data-match={String(matches)}>
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />Σ {totals} {matches ? '= header' : `≠ header ${text(headerTarget ?? '')}`}
    </Badge>
  );
}

function useColumns({ timezone, productName }: Pick<PeriodPreviewProps, 'timezone' | 'productName'>): DataTableColumn<PlanPeriodView>[] {
  const pref = useCalendarPreference();
  return [
    { id: 'date', header: 'Date', nowrap: true, cell: (p) => <span data-testid="preview-period" data-shift={p.shiftName} data-target={p.target} data-excluded={p.isExcluded}>{formatOperationalDate(p.localDate, pref)}</span> },
    { id: 'shift', header: 'Shift', cell: (p) => p.shiftName },
    { id: 'interval', header: 'Interval', nowrap: true, cell: (p) => <span className="text-xs"><PlantTime iso={p.utcStart} tz={timezone} /> → <PlantTime iso={p.utcEnd} tz={timezone} /></span> },
    { id: 'scheduled', header: 'Scheduled', align: 'right', nowrap: true, cell: (p) => <DurationText seconds={p.scheduledSeconds} variant="compact" /> },
    { id: 'product', header: 'Product', cell: (p) => productName(p.productId) },
    { id: 'target', header: 'Target', align: 'right', nowrap: true, cell: (p) => <span data-testid="period-target"><Quantity value={p.target} uom={p.quantityUom} /></span> },
    { id: 'planning', header: 'Planning capacity', align: 'right', nowrap: true, cell: (p) => <Quantity value={p.planningCapacityQty} uom={p.quantityUom} /> },
    { id: 'sustained', header: 'Sustained capacity', align: 'right', nowrap: true, cell: (p) => <Quantity value={p.sustainedCapacityQty} uom={p.quantityUom} /> },
    { id: 'status', header: 'Status', cell: (p) => (p.isExcluded ? `Excluded${p.exclusionKind ? ` (${labelOf(PERIOD_EXCLUSION_LABELS, p.exclusionKind)})` : ''}` : 'Eligible') },
  ];
}

/** The preview: every period the server would store, its target and capacities, totals and warnings (20 per page). */
export function PeriodPreview({ preview, headerTarget, timezone, productName }: PeriodPreviewProps) {
  const { number } = useNumberFormat();
  const columns = useColumns({ timezone, productName });
  return (
    <section className="space-y-2" data-testid="period-preview">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Preview of version {preview.version}</span>
        <Badge variant="outline">{labelOf(DISTRIBUTION_LABELS, preview.distribution)}</Badge>
        <SumBadge preview={preview} headerTarget={headerTarget} />
        <span className="text-muted-foreground">{number(preview.periods.length)} periods · nothing stored</span>
      </div>
      {preview.warnings.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-amber-700" data-testid="preview-warnings">
          {preview.warnings.map((warning, index) => (
            <li key={`${warning.code}-${warning.at ?? index}`} data-code={warning.code}>
              {labelOf(PLAN_WARNING_LABELS, warning.code)}
              {warning.at && (
                <>
                  {' '}
                  at <PlantTime iso={warning.at} tz={timezone} withDate />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <DataTable caption="Previewed periods" columns={columns} rows={preview.periods} getRowKey={(p) => `${p.sliceId}-${p.utcStart}`} density="compact" />
    </section>
  );
}
