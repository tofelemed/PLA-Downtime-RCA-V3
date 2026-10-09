import { useDowntimeReport } from '@/api/v2/queries/reports';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { downtimeQuery, type DowntimeFilters } from '../model/downtime-filters';
import { formatCount, formatRatio } from '../model/kpi-display';
import { ReportCard } from './report-card';

/** Downtime per crew of the shift instances (calendar crews, D03), with the server's share. */
export function CrewComparison({ filters }: { filters: DowntimeFilters }) {
  const env = useEventHubEnv();
  const query = useDowntimeReport(downtimeQuery(filters, 'crew'), env.timezone);
  const report = query.data?.data;
  const groups = report?.groups ?? [];
  return (
    <ReportCard
      title="Crew comparison"
      testId="crew-comparison"
      query={query}
      response={query.data}
      isEmpty={groups.length === 0}
      note="Crew of the shift each period belongs to; periods without a crew rotation are “No crew”."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Crew</TableHead>
            <TableHead>{report?.unit === 'count' ? 'Stops' : 'Downtime'}</TableHead>
            <TableHead>Share</TableHead>
            <TableHead>Periods</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.key ?? 'none'} data-testid="crew-row">
              <TableCell>{group.label ?? (group.key ? 'Unknown crew' : 'No crew')}</TableCell>
              <TableCell>{report?.unit === 'count' ? formatCount(group.value) : <DurationText seconds={group.value} variant="compact" />}</TableCell>
              <TableCell>{formatRatio(group.share)}</TableCell>
              <TableCell>{group.periods}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ReportCard>
  );
}
