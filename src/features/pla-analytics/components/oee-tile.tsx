import type { KpiAggregateView } from '@/api/v2/types/reports';
import { Badge } from '@/components/ui/badge';
import { labelOf } from '@/features/ux-kit/labels';
import { kpiText, QUALITY_STATE_LABELS } from '../model/display';

export interface OeeTileProps {
  title: string;
  /** policy label from the server ("Operational OEE (ISO 22400)" / "Reconciled PLA OEE") */
  label: string;
  view: KpiAggregateView | undefined;
  /** what the denominator is (KPI04: a tile never changes definition without saying so) */
  denominator: string;
  testId: string;
}

/** Quality flags said once for the page (provisional) or not worth a flag (ok). */
const QUIET_QUALITY = new Set(['ok', 'provisional']);

/**
 * One OEE figure with its policy label and denominator (KPI04); without a server value it says "Not
 * available: <reason>" (T41) — never a default 87 % or 100 %.
 */
export function OeeTile({ title, label, view, denominator, testId }: OeeTileProps) {
  return (
    <div className="rounded-md border p-3" data-testid={testId} data-value={view?.value ?? ''} data-reason={view?.reason ?? ''}>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-xl font-semibold" data-testid="oee-tile-value">
        {kpiText(view)}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {label} · {denominator}
      </p>
      {view && !QUIET_QUALITY.has(view.quality) && view.value !== null && (
        <Badge variant={view.quality === 'exception' ? 'destructive' : 'secondary'} className="mt-1">
          {labelOf(QUALITY_STATE_LABELS, view.quality)}
        </Badge>
      )}
    </div>
  );
}
