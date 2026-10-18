import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import type { RcaRecommendationView } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useCalendarPreference, type DigitSystem } from '@/lib/dates';
import { DismissRecommendation } from '../components/dismiss-recommendation';
import { recommendationDetail, recommendationText } from '../model/rca-labels';
import { useRcaFormat } from '../use-rca-format';
import { useUnitNames } from '../use-unit-names';

interface Context {
  unitName: (id: string | null) => string;
  dateTime: (value: string | null) => string;
  digits: DigitSystem | undefined;
  canWrite: boolean;
}

const caseHref = (rec: RcaRecommendationView, mode?: 'existing') =>
  `/rca/new?eventId=${encodeURIComponent(rec.eventId)}${mode ? `&mode=${mode}` : ''}`;

function RowActions({ rec, canWrite }: { rec: RcaRecommendationView; canWrite: boolean }) {
  if (!canWrite) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Button asChild size="sm" variant="outline" data-testid="recommendation-create-case">
        <Link to={caseHref(rec)}>Create investigation</Link>
      </Button>
      <Button asChild size="sm" variant="ghost" data-testid="recommendation-link-case">
        <Link to={caseHref(rec, 'existing')}>Link to existing</Link>
      </Button>
      <DismissRecommendation recommendation={rec} />
    </span>
  );
}

function columnsOf(context: Context): DataTableColumn<RcaRecommendationView>[] {
  return [
    {
      id: 'event',
      header: 'Event',
      cell: (rec) => (
        <Link className="underline" to={`/events/${encodeURIComponent(rec.eventId)}`} data-testid="recommendation-event">
          Event on {context.unitName(rec.unitId)}
        </Link>
      ),
    },
    { id: 'reason', header: 'Reason', cell: (rec) => rec.event?.reasonName ?? <span className="text-muted-foreground">Not coded</span> },
    { id: 'asset', header: 'Asset', cell: (rec) => rec.event?.assetName ?? <span className="text-muted-foreground">No asset</span> },
    { id: 'start', header: 'Start', cell: (rec) => (rec.event ? context.dateTime(rec.event.startTime) : '—'), nowrap: true },
    {
      id: 'why',
      header: 'Why recommended',
      cell: (rec) => (
        <span className="flex flex-col">
          <span>{recommendationText(rec)}</span>
          <span className="text-xs text-muted-foreground">{recommendationDetail(rec, context.digits)}</span>
        </span>
      ),
    },
    { id: 'fired', header: 'Recommended on', cell: (rec) => context.dateTime(rec.firedAt), nowrap: true },
    { id: 'actions', header: 'Actions', cell: (rec) => <RowActions rec={rec} canWrite={context.canWrite} /> },
  ];
}

/**
 * F-1: the open RCA recommendations of the scope (`GET /v2/rca-recommendations?state=open`, keyset pages
 * of 20, newest first as the server orders them). A person creates or links an investigation, or dismisses
 * the recommendation with a reason. Reason, asset and start come from the event (`event`, null when unreadable).
 */
export function RecommendationQueue({ unitId }: { unitId?: string }) {
  const { canWriteRca } = useCapabilities();
  const { unitName } = useUnitNames();
  const { dateTime } = useRcaFormat();
  const { digits } = useCalendarPreference();
  const query = useMemo(() => ({ state: 'open', ...(unitId ? { unitId } : {}) }), [unitId]);
  const paged = usePagedQuery<RcaRecommendationView>({ resource: 'rca-recommendations', path: '/rca-recommendations', query, key: { filters: query } });
  const columns = useMemo(() => columnsOf({ unitName, dateTime, digits, canWrite: canWriteRca }), [unitName, dateTime, digits, canWriteRca]);
  return (
    <div data-testid="recommendation-queue">
      <DataTable
        caption="Open RCA recommendations"
        columns={columns}
        rows={paged.rows}
        getRowKey={(rec) => rec.id}
        pager={paged.pager}
        status={paged.status}
        empty={{ title: 'No open recommendations', text: 'No RCA trigger has fired on an event without an investigation.' }}
      />
    </div>
  );
}
