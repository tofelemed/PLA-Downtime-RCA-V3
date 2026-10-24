import type { DataCoverageView } from '@/api/v2/types/reports';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { NO_PLAN_TEXT, NoPlanLink } from '@/features/month-close/components/no-plan-notice';
import { plural } from '@/features/ux-kit/format/plural';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { formatRatio } from '../model/kpi-display';

const UNKNOWN_TIME_INFO = 'Time without state data is not counted as scheduled or available time, nor in MTBF.';

/** True when the window has time without state data (some scheduled time is unknown). */
function hasUnknownStateTime(coverage: DataCoverageView | undefined): boolean {
  if (!coverage || coverage.periodsWithStateData === 0) return false;
  return coverage.unknownSeconds !== null && /[1-9]/.test(coverage.unknownSeconds);
}

/**
 * Owner decision 2026-10-19 "Unknown time is never available time": the server leaves time without state
 * data out of scheduled time, availability and MTBF; this line states how much of the window the data
 * covers, and names the periods no approved plan covers with the shared wording.
 */
export function DataCoverageNote({ coverage }: { coverage: DataCoverageView | undefined }) {
  const format = useNumberFormat();
  if (!coverage) return null;
  const unknown = hasUnknownStateTime(coverage);
  const noPlan = coverage.periodsWithoutPlan;
  if (!unknown && noPlan === 0) return null;
  return (
    <div className="space-y-1 text-xs text-muted-foreground" role="note" data-testid="data-coverage-note">
      {unknown && (
        <p className="flex items-center gap-1.5" data-testid="data-coverage">
          Data covers {formatRatio(coverage.ratio, 0, format.digits)} of the window
          <KpiInfo label="Data coverage" text={UNKNOWN_TIME_INFO} />
        </p>
      )}
      {noPlan > 0 && (
        <p data-testid="data-coverage-no-plan">
          {plural(noPlan, 'period', 'periods', format.number)} in this window: <NoPlanLink text={NO_PLAN_TEXT} />
        </p>
      )}
    </div>
  );
}
