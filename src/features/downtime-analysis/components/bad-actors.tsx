import { useDowntimeReport } from '@/api/v2/queries/reports';
import type { DowntimeGroupView } from '@/api/v2/types/reports';
import { DurationText } from '@/features/ux-kit/duration-text';
import { VirtualList } from '@/features/ux-kit/virtual-list';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { downtimeQuery, type DowntimeFilters } from '../model/downtime-filters';
import { formatCount, formatRatio } from '../model/kpi-display';
import { ReportCard } from './report-card';

const ROW_HEIGHT = 44;

/**
 * Asset bad actors (AN01): downtime per asset, largest first, with the stop count beside it — both from
 * the server. The breakdown is allocated: where stops of several assets overlap, each moment is shared
 * between them, so the asset bars add up to the unit downtime (decision 2.7, see plan 3.3 deviations).
 */
export function BadActors({ filters }: { filters: DowntimeFilters }) {
  const env = useEventHubEnv();
  const duration = useDowntimeReport(downtimeQuery(filters, 'asset', { metric: 'duration' }), env.timezone);
  const frequency = useDowntimeReport(downtimeQuery(filters, 'asset', { metric: 'frequency' }), env.timezone);
  const groups = duration.data?.data.groups ?? [];
  const stops = new Map((frequency.data?.data.groups ?? []).map((group) => [group.key, group.value]));
  return (
    <ReportCard
      title="Asset bad actors"
      testId="bad-actors"
      query={duration}
      response={duration.data}
      isEmpty={groups.length === 0}
      note="Allocated: overlapping stops of several assets share each moment, so asset totals add up to the unit downtime. Stops without an asset are listed as “No asset”."
    >
      <VirtualList
        items={groups}
        rowHeight={ROW_HEIGHT}
        height={Math.min(groups.length, 6) * ROW_HEIGHT + 4}
        getKey={(group) => group.key ?? 'none'}
        renderRow={(group) => <ActorRow group={group} stops={stops.get(group.key)} />}
      />
    </ReportCard>
  );
}

function ActorRow({ group, stops }: { group: DowntimeGroupView; stops: string | undefined }) {
  const width = group.share === null ? '0%' : formatRatio(group.share, 2).replace(' ', '');
  return (
    <div className="space-y-1 px-1 py-1" data-testid="bad-actor" data-key={group.key ?? ''} data-value={group.value}>
      <div className="flex justify-between gap-2 text-sm">
        <span className="truncate">{group.label ?? (group.key ? 'Unknown asset' : 'No asset')}</span>
        <span className="font-mono text-xs">
          <DurationText seconds={group.value} variant="compact" /> · {stops === undefined ? '—' : formatCount(stops)} stops
        </span>
      </div>
      <div className="h-1.5 rounded bg-muted" aria-hidden>
        <div className="h-1.5 rounded bg-primary" style={{ width }} />
      </div>
    </div>
  );
}
