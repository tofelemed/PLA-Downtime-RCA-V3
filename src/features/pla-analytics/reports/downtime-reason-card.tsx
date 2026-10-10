import { useDowntimeReport } from '@/api/v2/queries/reports';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { scopeBase, type AnalyticsScope } from '../model/analytics-scope';
import { shareText } from '../model/display';

/** Downtime by reason (Reports tab): the 2.7 report's allocated seconds per reason, server order (Pareto). */
export function DowntimeReasonCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useDowntimeReport({ ...scopeBase(scope), groupBy: 'reason' }, env.timezone);
  const data = query.data?.data;
  return (
    <ReportCard title="Downtime by reason" testId="report-downtime" query={query} response={query.data} isEmpty={data?.groups.length === 0} emptyText="No downtime in these periods.">
      {data && (
        <Table aria-label="Downtime by reason">
          <TableHeader>
            <TableRow>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Downtime</TableHead>
              <TableHead className="text-right">Share</TableHead>
              <TableHead className="text-right">Periods</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.groups.map((group) => (
              <TableRow key={group.key ?? '-'} data-testid="report-downtime-row" data-key={group.key ?? ''}>
                <TableCell>{group.label ?? (group.key ? 'Unknown' : 'Not coded')}</TableCell>
                <TableCell className="text-right">
                  <DurationText seconds={group.value} variant="clock" />
                </TableCell>
                <TableCell className="text-right">{shareText(group.share)}</TableCell>
                <TableCell className="text-right">{group.periods}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ReportCard>
  );
}
