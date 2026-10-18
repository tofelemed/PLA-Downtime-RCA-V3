import type { ToleranceView } from '@/api/v2/types/reconciliation';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

type Justification = NonNullable<ToleranceView['justification']>;

/** A missing budget, a budget past its review or a value no longer equal to U is a failed check (red, §5.8). */
const budgetFailed = (j: Justification) => !j.found || j.reviewOverdue || !j.valueMatchesExpandedUncertainty;

/**
 * The tolerance of the revision and, for an absolute tolerance adopted from an SME E4 uncertainty budget,
 * its justification: expanded uncertainty U = k·u_c of the boundary's budget, the calibration evidence and
 * the review date — with a warning when the budget is past its review or the value no longer equals U.
 * Every number is the server's.
 */
export function ToleranceBadge({ tolerance, timezone }: { tolerance: ToleranceView; timezone: string }) {
  const { text } = useNumberFormat();
  const value = tolerance.mode === 'zero' ? 'none' : tolerance.mode === 'percent' ? text(`${tolerance.value} %`) : text(String(tolerance.value));
  const justification = tolerance.justification;
  if (!justification) return <StatusBadge tone="neutral">Tolerance: {value}</StatusBadge>;
  return (
    <details className="text-xs" data-testid="tolerance-justification">
      <summary className="cursor-pointer">
        <StatusBadge tone={budgetFailed(justification) ? 'danger' : 'neutral'}>Tolerance: {value} · expanded measurement uncertainty</StatusBadge>
      </summary>
      {justification.found ? (
        <div className="mt-1 space-y-0.5 text-muted-foreground">
          <p>
            Absolute tolerance = expanded uncertainty <Quantity value={justification.expandedUncertainty} uom={justification.uom} fractionDigits={3} /> (k = {text(justification.coverageFactor ?? '—')}, combined
            standard uncertainty <Quantity value={justification.combinedStandardUncertainty} uom={justification.uom} fractionDigits={3} />) of the {justification.boundary} budget.
          </p>
          <p>
            Calibration: {justification.calibrationRef} · review due {justification.reviewDueAt ? <PlantTime iso={justification.reviewDueAt} tz={timezone} withDate /> : '—'}
          </p>
          {justification.reviewOverdue && <p className="text-destructive">The budget is past its review date.</p>}
          {!justification.valueMatchesExpandedUncertainty && <p className="text-destructive">The tolerance no longer equals the budget&apos;s expanded uncertainty.</p>}
        </div>
      ) : (
        <p className="mt-1 text-destructive">The referenced uncertainty budget was not found.</p>
      )}
    </details>
  );
}
