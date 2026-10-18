import type { KpiAggregateView } from '@/api/v2/types/reports';
import { Badge } from '@/components/ui/badge';
import { useCalendarPreference } from '@/lib/dates';
import { labelOf } from '@/features/ux-kit/labels';
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

/** "—", a small "Not available" and the server's reason as a one-line caption (full text on hover). */
function Unavailable({ reason, showReason }: { reason: string; showReason: boolean }) {
  return (
    <>
      <p className="text-xl font-semibold" data-testid="oee-tile-value">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Not available</span>
      </p>
      <p className="text-xs font-medium text-muted-foreground" aria-hidden="true">
        Not available
      </p>
      {showReason && (
        <p className="truncate text-xs text-muted-foreground" title={reason} data-testid="oee-tile-reason">
          {reason}
        </p>
      )}
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
 * One OEE figure with its policy label and denominator (KPI04); without a server value it shows "—" with
 * "Not available" and the reason as a muted caption (T41) — never a default 87 % or 100 %.
 */
export function OeeTile({ title, label, view, denominator, testId, showReason = true }: OeeTileProps) {
  const { digits } = useCalendarPreference();
  const reason = unavailableReason(view);
  return (
    <div className="min-w-0 rounded-md border p-3" data-testid={testId} data-value={view?.value ?? ''} data-reason={view?.reason ?? ''}>
      <p className="text-xs text-muted-foreground">{title}</p>
      {reason !== null ? (
        <Unavailable reason={reason} showReason={showReason} />
      ) : (
        <p className="text-xl font-semibold" data-testid="oee-tile-value">
          {kpiText(view, digits)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {label} · {denominator}
      </p>
      <QualityBadge view={view} />
    </div>
  );
}
