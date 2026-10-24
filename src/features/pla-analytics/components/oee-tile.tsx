import type { KpiAggregateView } from '@/api/v2/types/reports';
import { Badge } from '@/components/ui/badge';
import { useCalendarPreference } from '@/lib/dates';
import { labelOf } from '@/features/ux-kit/labels';
import { KpiInfo } from '../dashboard/kpi-info';
import { unavailableReason } from '../dashboard/kpi-unavailable';
import { kpiText, QUALITY_STATE_LABELS } from '../model/display';

export interface OeeTileProps {
  title: string;
  /** policy label from the server ("Operational OEE (ISO 22400)" / "Reconciled PLA OEE") */
  label: string;
  view: KpiAggregateView | undefined;
  /** what the denominator is (KPI04: a tile never changes definition without saying so) */
  denominator: string;
  testId: string;
  /** default true; false when the group says the shared reason once (`sharedUnavailableReason`) */
  showReason?: boolean;
}

/** Quality flags said once for the page (provisional) or not worth a flag (ok). */
const QUIET_QUALITY = new Set(['ok', 'provisional']);

/** "—" and a small "Not available"; the server's reason is said in the tile's ⓘ. */
function Unavailable() {
  return (
    <>
      <p className="mt-2 text-2xl font-semibold" data-testid="oee-tile-value">
        <span aria-hidden="true">—</span>
      </p>
      <p className="text-xs font-medium text-muted-foreground">Not available</p>
    </>
  );
}

/** The quality flag of a shown value (exception / incomplete), none for ok and provisional. */
function QualityBadge({ view }: { view: KpiAggregateView | undefined }) {
  if (!view || view.value === null || QUIET_QUALITY.has(view.quality)) return null;
  return (
    <Badge variant={view.quality === 'exception' ? 'destructive' : 'secondary'} className="mt-1">
      {labelOf(QUALITY_STATE_LABELS, view.quality)}
    </Badge>
  );
}

/**
 * One OEE figure in the dashboard's tile look (cleanup 24 Oct 2026): small uppercase label with an ⓘ that says
 * the policy label and denominator (KPI04) and, without a server value, why (T41); the value, or "—" with
 * "Not available" — never a default 87 % or 100 %. No caption under the value.
 */
export function OeeTile({ title, label, view, denominator, testId, showReason = true }: OeeTileProps) {
  const { digits } = useCalendarPreference();
  const reason = unavailableReason(view);
  const info = `${label} · ${denominator}${reason !== null && showReason ? `. Not available: ${reason}` : ''}`;
  return (
    <div className="min-w-0 rounded-md border bg-canvas p-3" data-testid={testId} data-value={view?.value ?? ''} data-reason={view?.reason ?? ''} data-reason-text={reason ?? ''}>
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 min-w-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
        <KpiInfo label={title} text={info} />
      </div>
      {reason !== null ? (
        <Unavailable />
      ) : (
        <p className="mt-2 text-2xl font-semibold tabular-nums" data-testid="oee-tile-value">
          {kpiText(view, digits)}
        </p>
      )}
      <QualityBadge view={view} />
    </div>
  );
}
