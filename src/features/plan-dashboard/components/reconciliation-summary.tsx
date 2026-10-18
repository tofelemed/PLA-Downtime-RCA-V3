import type { ReconciliationView, SliceReconciliationView } from '@/api/v2/types/reconciliation';
import { labelOf } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { FLAG_LABELS } from '../model/display';
import { residualStateOf } from '../model/residual-state';
import { ResidualStateBadge } from './residual-state-badge';

type FigureKey = keyof Pick<SliceReconciliationView, 'target' | 'actual' | 'gap' | 'attributed' | 'toleranceAdjustment' | 'residual' | 'overAccounted' | 'overproduction' | 'tolerance'>;

/** The plan identity as one equation; the operators are text between the server's figures. */
const EQUATION: Array<{ key: FigureKey; label: string; before?: string }> = [
  { key: 'target', label: 'Target' },
  { key: 'actual', label: 'Actual (good)', before: '−' },
  { key: 'gap', label: 'Gap', before: '=' },
  { key: 'attributed', label: 'Attributed', before: '=' },
  { key: 'toleranceAdjustment', label: 'Tolerance adj.', before: '+' },
  { key: 'residual', label: 'Unaccounted', before: '+' },
];

const CHECKS: Array<{ key: FigureKey; label: string }> = [
  { key: 'overAccounted', label: 'Over-accounted' },
  { key: 'overproduction', label: 'Overproduction' },
  { key: 'tolerance', label: 'Tolerance threshold' },
];

function Figure({ slice, figure, label, emphasis }: { slice: SliceReconciliationView; figure: FigureKey; label: string; emphasis?: boolean }) {
  return (
    <dl data-testid={`figure-${figure}`} data-value={String(slice[figure] ?? '')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={emphasis ? 'font-semibold text-warning' : 'font-medium'}>
        <Quantity value={slice[figure]} uom={slice.uom} />
      </dd>
    </dl>
  );
}

function SliceFigures({ slice }: { slice: SliceReconciliationView }) {
  const aboveTolerance = residualStateOf(slice.flags)?.tone === 'warning';
  return (
    <div className="space-y-2 rounded-md border p-2" data-testid="slice-figures" data-slice-id={slice.sliceId}>
      <div role="group" className="flex flex-wrap items-end gap-x-3 gap-y-2 text-sm" aria-label="Target minus actual equals gap equals attributed plus tolerance adjustment plus unaccounted">
        {EQUATION.map(({ key, label, before }) => (
          <div key={key} className="flex items-end gap-3">
            {before && (
              <span aria-hidden className="pb-0.5 text-lg text-muted-foreground">
                {before}
              </span>
            )}
            <Figure slice={slice} figure={key} label={label} emphasis={key === 'residual' && aboveTolerance} />
          </div>
        ))}
        <div className="pb-0.5">
          <ResidualStateBadge flags={slice.flags} />
        </div>
      </div>
      <div role="group" className="flex flex-wrap items-end gap-x-6 gap-y-1 border-t pt-2 text-xs" aria-labelledby={`checks-${slice.sliceId}`}>
        <span id={`checks-${slice.sliceId}`} className="font-medium text-muted-foreground">
          Checks
        </span>
        {CHECKS.map(({ key, label }) => (
          <Figure key={key} slice={slice} figure={key} label={label} />
        ))}
      </div>
      {slice.flags.length > 0 && <p className="text-xs text-muted-foreground">Status: {slice.flags.map((f) => labelOf(FLAG_LABELS, f)).join(', ')}</p>}
    </div>
  );
}

/** Plan-ledger identity per slice as the server computed it (ACC07/ACC09): target − actual = gap = attributed + tolerance adj. + unaccounted. */
export function ReconciliationSummary({ view }: { view: ReconciliationView }) {
  return (
    <div className="space-y-2" data-testid="reconciliation-summary">
      {view.slices.map((slice) => (
        <SliceFigures key={slice.sliceId} slice={slice} />
      ))}
      {view.slices.length === 0 && <p className="text-sm text-muted-foreground">No calculated slices yet (recompute the period).</p>}
    </div>
  );
}
