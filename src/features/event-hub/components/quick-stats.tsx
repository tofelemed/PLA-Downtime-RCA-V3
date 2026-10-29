import { useDowntimeReport } from '@/api/v2/queries/reports';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { DowntimeReportView } from '@/api/v2/types/reports';
import { Card, CardContent } from '@/components/ui/card';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DurationText } from '@/features/ux-kit/duration-text';
import type { EventFilterState } from '../model/event-filters';
import { useEventHubEnv } from '../use-event-hub-env';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { DeclaredToCodeStat } from './declared-to-code-stat';

/** Why a figure is partial: no period starts in the window at all (a day-grain plant on an 8 h window) or some are missing. */
export const NO_PERIOD_IN_WINDOW = 'No accounting period starts in this window; choose a whole production day or a longer window.';
export const PARTIAL_PERIODS = 'Only calculated periods are counted.';

/** The banner text under a partial figure, or none when the report covers every period of the window. */
function incompleteDetail(report: AnalyticsResponse<DowntimeReportView> | undefined): string | undefined {
  if (!report || (report.coverage.ratio >= 1 && report.dataQuality.missingCount === 0)) return undefined;
  return report.coverage.ratio === 0 ? NO_PERIOD_IN_WINDOW : PARTIAL_PERIODS;
}

/**
 * Downtime of the current units and window from the server (union seconds of the calculated periods,
 * plan 2.7) — never summed from loaded rows; the window is the filter bar's, so the label does not repeat it.
 * The report covers calculated periods only, so it is labelled provisional/incomplete exactly as the API says.
 */
export function QuickStats({ filters, declared = false }: { filters: EventFilterState; declared?: boolean }) {
  const { number } = useNumberFormat();
  const env = useEventHubEnv();
  const query = useDowntimeReport(
    filters.from && filters.to
      ? { from: filters.from, to: filters.to, unitIds: filters.unitIds.length > 0 ? [...filters.unitIds].sort() : undefined }
      : null,
    env.timezone,
  );
  const report = query.data;
  const detail = incompleteDetail(report);
  const state = dataStateOf(query, { isIncomplete: detail !== undefined });
  return (
    <Card data-testid="quick-stats">
      <CardContent className="flex flex-wrap items-center gap-6 py-3 text-sm">
        <DataState state={state} error={query.error} detail={detail}>
          <div>
            <div className="text-xs text-muted-foreground">Downtime</div>
            <div className="text-2xl font-semibold" data-testid="quick-stats-downtime">
              <DurationText seconds={report?.data.total} />
            </div>
          </div>
          {report && (
            <div className="text-xs text-muted-foreground" title={`Based on ${number(report.data.calculationRunIds.length)} calculation runs`}>
              {report.isProvisional ? 'Provisional' : 'Approved'}
            </div>
          )}
        </DataState>
        {declared && <DeclaredToCodeStat filters={filters} />}
      </CardContent>
    </Card>
  );
}
