import { useDowntimeReport } from '@/api/v2/queries/reports';
import type { DowntimeReportView } from '@/api/v2/types/reports';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { formatCount } from '@/features/downtime-analysis/model/kpi-display';
import { repeatQuery, type AnalyticsScope } from '../model/analytics-scope';
import { shareText } from '../model/display';

/**
 * Repeat causes (AN02): stop occurrences per reason and per asset with the number of periods each one
 * recurs in — the 2.7 downtime report with `metric=frequency`, ordered by the server (Pareto).
 */
export function RepeatCausesTab({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const byReason = useDowntimeReport(repeatQuery(scope, 'reason'), env.timezone);
  const byAsset = useDowntimeReport(repeatQuery(scope, 'asset'), env.timezone);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportCard title="Repeat causes by reason" testId="pla-repeat-reasons" query={byReason} response={byReason.data} isEmpty={byReason.data?.data.groups.length === 0} emptyText="No stops in this scope." note="Stops starting in the window; “periods” = shifts the cause recurred in.">
        {byReason.data && <RepeatTable report={byReason.data.data} title="Reason" testId="repeat-reasons" />}
      </ReportCard>
      <ReportCard title="Repeat causes by asset" testId="pla-repeat-assets" query={byAsset} response={byAsset.data} isEmpty={byAsset.data?.data.groups.length === 0} emptyText="No stops on assets in this scope." note="Allocated to the asset of the stop (2.7).">
        {byAsset.data && <RepeatTable report={byAsset.data.data} title="Asset" testId="repeat-assets" />}
      </ReportCard>
    </div>
  );
}

function RepeatTable({ report, title, testId }: { report: DowntimeReportView; title: string; testId: string }) {
  return (
    <Table data-testid={testId} aria-label={`Repeat causes by ${title.toLowerCase()}`}>
      <TableHeader>
        <TableRow>
          <TableHead>{title}</TableHead>
          <TableHead className="text-right">Stops</TableHead>
          <TableHead className="text-right">Periods</TableHead>
          <TableHead className="text-right">Cumulative</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.groups.map((group) => (
          <TableRow key={group.key ?? '-'} data-testid="repeat-row" data-key={group.key ?? ''} data-count={group.value} data-periods={group.periods}>
            <TableCell>{group.label ?? (group.key ? 'Unknown' : 'Not coded')}</TableCell>
            <TableCell className="text-right">{formatCount(group.value)}</TableCell>
            <TableCell className="text-right">{group.periods}</TableCell>
            <TableCell className="text-right">{shareText(group.cumulativeShare)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
