import type { RcaActionView } from '@/api/v2/types/rca';
import type { RcaActionBaseline } from '@/api/v2/types/rca-workflow';
import { formatDecimal } from '@/features/ux-kit/format/decimal';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_BASELINE_METRIC_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { useRcaFormat } from '../use-rca-format';
import { BaselineCorrection } from './baseline-correction';

/** Run seconds of the server's exposure window shown in hours (a unit change, no business figure). */
const runHours = (seconds: string) => formatDecimal(String(Number(seconds) / 3600), 0);

function Criteria({ baseline }: { baseline: RcaActionBaseline }) {
  const criteria = baseline.criteria;
  if (!criteria) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="baseline-criteria">
      Effective when the same-mode rate falls by at least {formatDecimal(String(criteria.requiredReduction * 100), 0)} % over at least{' '}
      {formatDecimal(String(criteria.minExposureHours), 0)} run hours{criteria.zeroRepeat ? '; any repeat counts as not effective (high consequence)' : ''}.
    </p>
  );
}

function Counted({ baseline }: { baseline: RcaActionBaseline }) {
  const { date } = useRcaFormat();
  const metric = labelOf(RCA_BASELINE_METRIC_LABELS, baseline.metric).toLowerCase();
  const span = baseline.window;
  if (!span) {
    return (
      <>
        baseline {formatDecimal(baseline.value, 2)} {metric} over {baseline.windowDays} days ({baseline.declared ? 'declared before the server counted baselines' : 'counted from history'})
      </>
    );
  }
  return (
    <>
      baseline counted from history ({date(span.from)} – {date(span.to)}): {span.incidents} same-mode incident(s), {formatDuration(span.downtimeSeconds, 'long')} downtime,{' '}
      {runHours(span.exposureSeconds)} run hours
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
