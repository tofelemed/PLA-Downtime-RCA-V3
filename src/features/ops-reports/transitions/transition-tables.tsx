import type { TransitionPairView, TransitionRowView } from '@/api/v2/types/ops-reports';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { NumberText } from '@/features/ux-kit/number-text';
import { PlantTime } from '@/features/ux-kit/plant-time';

const change = (row: { fromProduct: string | null; toProduct: string | null }) => `${row.fromProduct ?? '?'} → ${row.toProduct ?? '?'}`;
const duration = (seconds: string | null) => (seconds === null ? '—' : <DurationText seconds={seconds} />);

/** Seconds over (+, red) or under (−) a standard. */
function SignedDuration({ seconds }: { seconds: string }) {
  const over = !seconds.startsWith('-') && Number(seconds) !== 0;
  // exactly on standard: no sign (never "−0 s")
  const sign = Number(seconds) === 0 ? '' : over ? '+' : '−';
  return (
    <span className={over ? 'font-medium text-destructive' : ''} data-testid="transition-excess" data-over={over}>
      {sign}
      <DurationText seconds={seconds.replace(/^-/, '')} />
    </span>
  );
}

/** A transition against its standard; words when it has none, is not calculated or still runs. */
function Excess({ row }: { row: TransitionRowView }) {
  if (!row.calculated) return <span className="text-muted-foreground">Not calculated</span>;
  if (row.noStandard || row.standardId === null) return <Badge variant="outline">No standard</Badge>;
  if (row.excessSeconds === null) return <span className="text-muted-foreground">Running</span>;
  return <SignedDuration seconds={row.excessSeconds} />;
}

const PAIR_COLUMNS: Array<DataTableColumn<TransitionPairView>> = [
  { id: 'change', header: 'Product change', cell: (p) => <span data-testid="transition-pair">{change(p)}</span> },
  { id: 'count', header: 'Transitions', align: 'right', cell: (p) => <NumberText value={p.transitions} /> },
  { id: 'mean', header: 'Mean', align: 'right', nowrap: true, cell: (p) => duration(p.meanSeconds) },
  { id: 'best', header: 'Best', align: 'right', nowrap: true, cell: (p) => duration(p.bestSeconds) },
  { id: 'worst', header: 'Worst', align: 'right', nowrap: true, cell: (p) => duration(p.worstSeconds) },
  { id: 'over', header: 'Over standard', align: 'right', nowrap: true, cell: (p) => <><NumberText value={p.overStandard} /> of <NumberText value={p.withStandard} /></> },
  { id: 'excess', header: 'Mean excess', align: 'right', nowrap: true, cell: (p) => (p.meanExcessSeconds === null ? '—' : <SignedDuration seconds={p.meanExcessSeconds} />) },
];

/** Product changes of the window, worst mean excess first. */
export function TransitionPairsTable({ pairs }: { pairs: readonly TransitionPairView[] }) {
  return <DataTable caption="Product changes" columns={PAIR_COLUMNS} rows={[...pairs]} getRowKey={(p) => `${p.fromProductId ?? '-'}>${p.toProductId ?? '-'}`} density="compact" />;
}

/** Each transition of the window, newest first, against its standard. */
export function TransitionsTable({ rows, timeZone }: { rows: readonly TransitionRowView[]; timeZone: string }) {
  const columns: Array<DataTableColumn<TransitionRowView>> = [
    { id: 'start', header: 'Start', nowrap: true, cell: (r) => <PlantTime iso={r.start} tz={timeZone} withDate /> },
    { id: 'unit', header: 'Unit', cell: (r) => r.unitName ?? '—' },
    { id: 'change', header: 'Product change', cell: (r) => change(r) },
    { id: 'duration', header: 'Duration', align: 'right', nowrap: true, cell: (r) => duration(r.seconds) },
    { id: 'standard', header: 'Standard', align: 'right', nowrap: true, cell: (r) => duration(r.referenceSeconds) },
    { id: 'excess', header: 'Against standard', align: 'right', nowrap: true, cell: (r) => <Excess row={r} /> },
    { id: 'allowance', header: 'Loss within standard', align: 'right', nowrap: true, cell: (r) => <><NumberText value={r.allowanceLoss} fractionDigits={1} /> {r.allowanceLoss !== null ? r.uom : ''}</> },
    { id: 'overrun', header: 'Loss over standard', align: 'right', nowrap: true, cell: (r) => <><NumberText value={r.excessLoss} fractionDigits={1} /> {r.excessLoss !== null ? r.uom : ''}</> },
    { id: 'offGrade', header: 'Off-grade', align: 'right', nowrap: true, cell: (r) => <NumberText value={r.offGrade} fractionDigits={1} /> },
  ];
  return <DataTable caption="Grade transitions" columns={columns} rows={[...rows]} getRowKey={(r) => r.eventId} density="compact" />;
}
