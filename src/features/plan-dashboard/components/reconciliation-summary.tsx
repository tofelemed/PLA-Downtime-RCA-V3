import type { ReconciliationView, SliceReconciliationView } from '@/api/v2/types/reconciliation';
import { labelOf } from '@/features/ux-kit/labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { FLAG_LABELS } from '../model/display';

/** Server flags of a residual beyond tolerance (plan 2.5 / 2.8): shown in red. */
const BLOCKING_FLAGS = new Set(['unaccounted', 'over_accounted', 'conflict']);

const FIGURES: Array<[keyof SliceReconciliationView, string]> = [
  ['target', 'Target'],
  ['actual', 'Actual (good)'],
  ['gap', 'Signed gap'],
  ['attributed', 'Attributed'],
  ['toleranceAdjustment', 'Tolerance adjustment'],
  ['residual', 'Residual'],
  ['overAccounted', 'Over-accounted'],
  ['overproduction', 'Overproduction'],
  ['tolerance', 'Tolerance'],
];

/** Plan-ledger identity per slice as the server computed it (ACC07/ACC09): target − actual = attributed + adjustment + residual. */
export function ReconciliationSummary({ view }: { view: ReconciliationView }) {
  return (
    <div className="space-y-2" data-testid="reconciliation-summary">
      {view.slices.map((slice) => (
        <dl key={slice.sliceId} className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-5 lg:grid-cols-9" data-testid="slice-figures" data-slice-id={slice.sliceId}>
          {FIGURES.map(([key, label]) => (
            <div key={key} data-testid={`figure-${key}`} data-value={String(slice[key] ?? '')}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={key === 'residual' && slice.flags.some((f) => BLOCKING_FLAGS.has(f)) ? 'font-semibold text-destructive' : 'font-medium'}>
                <Quantity value={slice[key] as string | null} uom={slice.uom} />
              </dd>
            </div>
          ))}
          {slice.flags.length > 0 && (
            <div className="col-span-full text-xs text-muted-foreground">
              <dt className="inline">Status: </dt>
              <dd className="inline">{slice.flags.map((f) => labelOf(FLAG_LABELS, f)).join(', ')}</dd>
            </div>
          )}
        </dl>
      ))}
      {view.slices.length === 0 && <p className="text-sm text-muted-foreground">No calculated slices yet (recompute the period).</p>}
    </div>
  );
}
