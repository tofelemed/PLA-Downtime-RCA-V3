import type { RcaActionView } from '@/api/v2/types/rca';
import type { RcaActionBaseline } from '@/api/v2/types/rca-workflow';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_BASELINE_METRIC_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { useRcaFormat } from '../use-rca-format';
import { BaselineCorrection } from './baseline-correction';

function Criteria({ baseline }: { baseline: RcaActionBaseline }) {
  const { number } = useNumberFormat();
  const criteria = baseline.criteria;
  if (!criteria) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="baseline-criteria">
      Effective when the same-mode rate falls by at least {number(criteria.requiredReduction * 100)} % over at least{' '}
      {number(criteria.minExposureHours)} run hours{criteria.zeroRepeat ? '; any repeat counts as not effective (high consequence)' : ''}.
    </p>
  );
}

function Counted({ baseline }: { baseline: RcaActionBaseline }) {
  const { date } = useRcaFormat();
  const { decimal, number, digits } = useNumberFormat();
  const metric = labelOf(RCA_BASELINE_METRIC_LABELS, baseline.metric).toLowerCase();
  const span = baseline.window;
  if (!span) {
    return (
      <>
        baseline {decimal(baseline.value, 2)} {metric} over {number(baseline.windowDays)} days ({baseline.declared ? 'declared before the server counted baselines' : 'counted from history'})
      </>
    );
  }
  return (
    <>
      baseline counted from history ({date(span.from)} – {date(span.to)}): {number(span.incidents)} same-mode incident(s), {formatDuration(span.downtimeSeconds, 'long', digits)} downtime,{' '}
      {/* run seconds of the server's exposure window shown in hours (a unit change, no business figure) */}
      {number(Number(span.exposureSeconds) / 3600)} run hours
    </>
  );
}

/**
 * The baseline the server counted (CA3: same assets and failure mode over run time), the acceptance
 * criteria frozen with it and the correction workflow. No browser-typed baseline exists any more.
 */
export function ActionBaseline({ action }: { action: RcaActionView }) {
  const baseline = action.baseline;
  if (!baseline) return <p className="text-sm text-muted-foreground">No baseline: this action is not verified.</p>;
  return (
    <div className="space-y-1" data-testid="action-baseline">
      <p className="text-sm">
        <Counted baseline={baseline} />
      </p>
      <Criteria baseline={baseline} />
      <BaselineCorrection action={action} baseline={baseline} />
    </div>
  );
}
