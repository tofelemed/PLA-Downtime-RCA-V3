import { useDowntimeReport } from '@/api/v2/queries/reports';
import { Card, CardContent } from '@/components/ui/card';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DurationText } from '@/features/ux-kit/duration-text';
import type { EventFilterState } from '../model/event-filters';
import { useEventHubEnv } from '../use-event-hub-env';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { DeclaredToCodeStat } from './declared-to-code-stat';

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
  const incomplete = report ? report.coverage.ratio < 1 || report.dataQuality.missingCount > 0 : false;
  const state = dataStateOf(query, { isIncomplete: incomplete });
  return (
    <Card data-testid="quick-stats">
      <CardContent className="flex flex-wrap items-center gap-6 py-3 text-sm">
        <DataState state={state} error={query.error} detail={incomplete ? 'Only calculated periods are counted.' : undefined}>
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
