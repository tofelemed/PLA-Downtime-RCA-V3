import type { CapacityGapRowView, CapacityGapStepView, CapacityRatioView } from '@/api/v2/types/capacity-gap';
import type { RateKind } from '@/api/v2/types/profiles';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { CHAIN_KINDS, kindLabel, rateText, reasonText, REFERENCE_KINDS } from './capacity-gap-model';

type Column = DataTableColumn<CapacityGapRowView>;

const kindColumn = (kind: RateKind): Column => ({
  id: kind,
  header: kindLabel(kind),
  align: 'right',
  nowrap: true,
  cell: (row) => <span data-testid={`capacity-${kind}`}>{rateText(row.rates[kind])}</span>,
});

function GapCell({ step }: { step: CapacityGapStepView | undefined }) {
  if (!step || step.gap === null) return <span className="text-muted-foreground">{reasonText(step?.reason ?? null)}</span>;
  return (
    <span>
      {step.gap}
      {step.ratio !== null && <span className="block text-xs text-muted-foreground">ratio {step.ratio}</span>}
    </span>
  );
}

const gapColumn = (index: number): Column => {
  const [upper, lower] = [CHAIN_KINDS[index], CHAIN_KINDS[index + 1]];
  return {
    id: `gap-${upper}-${lower}`,
    header: `${kindLabel(upper)} − ${kindLabel(lower)}`,
    align: 'right',
    nowrap: true,
    cell: (row) => <span data-testid={`capacity-gap-${index}`}><GapCell step={row.gaps.find((step) => step.upper === upper && step.lower === lower)} /></span>,
  };
};

function RatioCell({ view }: { view: CapacityRatioView | undefined }) {
  if (!view || view.ratio === null) return <span className="text-muted-foreground">{reasonText(view?.reason ?? null)}</span>;
  return <span>{view.ratio}</span>;
}

const ratioColumn = (numerator: RateKind, denominator: RateKind): Column => ({
  id: `ratio-${numerator}-${denominator}`,
  header: `${kindLabel(numerator)} ÷ ${kindLabel(denominator)}`,
  align: 'right',
  nowrap: true,
  cell: (row) => (
    <span data-testid={`capacity-ratio-${numerator}`}>
      <RatioCell view={row.ratios.find((ratio) => ratio.numerator === numerator && ratio.denominator === denominator)} />
    </span>
  ),
});

const COLUMNS: readonly Column[] = [
  { id: 'unit', header: 'Unit', nowrap: true, cell: (row) => row.unitName },
  { id: 'product', header: 'Product', cell: (row) => (row.operatingMode === 'normal' ? row.productName : `${row.productName} (${row.operatingMode})`) },
  kindColumn('nameplate'),
  gapColumn(0),
  kindColumn('demonstrated'),
  gapColumn(1),
  kindColumn('sustained'),
  gapColumn(2),
  kindColumn('planning'),
  ratioColumn('sustained', 'nameplate'),
  ratioColumn('planning', 'sustained'),
  ...REFERENCE_KINDS.map(kindColumn),
];

/** One row per approved profile: the rate kinds in chain order, the server's gap after each step, then the ratios. */
export function CapacityGapTable({ rows }: { rows: readonly CapacityGapRowView[] }) {
  return (
    <DataTable
      caption="Capacity gap by unit and product"
      columns={COLUMNS}
      rows={rows}
      getRowKey={(row) => row.profileId}
      pager="client"
      density="compact"
      scrollable
    />
  );
}
