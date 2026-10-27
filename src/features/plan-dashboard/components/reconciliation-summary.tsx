import type { LedgerKind } from '@/api/v2/types/period-overview';
import type { ReconciliationView, SliceReconciliationView } from '@/api/v2/types/reconciliation';
import { labelOf } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { FLAG_LABELS } from '../model/display';
import { isDataFlag, stopsCrossCheckOf } from '../model/candidate-derivation';
import { residualStateOf } from '../model/residual-state';
import { ResidualStateBadge } from './residual-state-badge';
import { LossAccountingStatement } from './loss-accounting-statement';

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

function SliceStatus({ slice }: { slice: SliceReconciliationView }) {
  const labelled = slice.flags.filter((flag) => !isDataFlag(flag));
  const check = stopsCrossCheckOf(slice.flags);
  return (
    <>
      {labelled.length > 0 && <p className="text-xs text-muted-foreground">Status: {labelled.map((f) => labelOf(FLAG_LABELS, f)).join(', ')}</p>}
      {check && (
        <p className="text-xs text-muted-foreground" data-testid="stops-cross-check">
          Stops cross-check: <Quantity value={check.quantity} uom={check.uom} /> recorded in stops
        </p>
      )}
    </>
  );
}

function SliceEquation({ slice }: { slice: SliceReconciliationView }) {
  const aboveTolerance = residualStateOf(slice.flags)?.tone === 'warning';
  return (
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
  );
}

/** A slice's checks and status; its plan identity as an equation only when the server sent no statement (older servers). */
function SliceFigures({ slice, equation }: { slice: SliceReconciliationView; equation: boolean }) {
  return (
    <div className="space-y-2 rounded-md border p-2" data-testid="slice-figures" data-slice-id={slice.sliceId}>
      {equation ? <SliceEquation slice={slice} /> : <ResidualStateBadge flags={slice.flags} />}
      <div role="group" className="flex flex-wrap items-end gap-x-6 gap-y-1 border-t pt-2 text-xs" aria-labelledby={`checks-${slice.sliceId}`}>
        <span id={`checks-${slice.sliceId}`} className="font-medium text-muted-foreground">
          Checks
        </span>
        {CHECKS.map(({ key, label }) => (
          <Figure key={key} slice={slice} figure={key} label={label} />
        ))}
      </div>
      <SliceStatus slice={slice} />
    </div>
  );
}

/**
 * The period's loss accounting statement (Task 13: planned, actual, shortfall, losses, gross attributed,
 * verified recovery, net accounted, unaccounted — the server's figures), then per slice the checks and the
 * stops cross-check. Older servers without a statement show the plan identity per slice as an equation.
 */
export function ReconciliationSummary({ view, ledger = 'plan' }: { view: ReconciliationView; ledger?: LedgerKind }) {
  return (
    <div className="space-y-2" data-testid="reconciliation-summary">
      {ledger === 'capacity' && (
        <p className="text-xs text-muted-foreground" data-testid="reconciliation-ledger-note">
          The reconciliation and the loss lines are always on the plan ledger (against the target). The capacity ledger is shown in the comparison and the waterfall below.
        </p>
      )}
      {view.statement && <LossAccountingStatement statement={view.statement} />}
      {view.slices.map((slice) => (
        <SliceFigures key={slice.sliceId} slice={slice} equation={!view.statement} />
      ))}
      {view.slices.length === 0 && <p className="text-sm text-muted-foreground">No calculated slices yet (recompute the period).</p>}
    </div>
  );
}
