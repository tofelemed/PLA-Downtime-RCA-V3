import type { ReactNode } from 'react';
import { useRcaSummary } from '@/api/v2/queries/rca-cases';
import { Skeleton } from '@/components/ui/skeleton';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { RCA_CASE_STATUS_TONES } from '@/features/ux-kit/labels';
import { TONE_SURFACE_CLASS, toneOf, type StatusTone } from '@/features/ux-kit/status-tone';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { cn } from '@/lib/utils';
import { isChipActive, type CaseListFilters, type SummaryChip } from '../model/case-filters';
import { statusLabel } from '../model/rca-labels';

interface ChipProps {
  chip: SummaryChip;
  filters: CaseListFilters;
  onPick: (chip: SummaryChip) => void;
  tone?: StatusTone;
  children: ReactNode;
}

/** One count as a toggle button: pressed while the list shows exactly what it counts. */
function Chip({ chip, filters, onPick, tone = 'neutral', children }: ChipProps) {
  const pressed = isChipActive(chip, filters);
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPick(chip)}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        TONE_SURFACE_CLASS[tone],
        pressed && 'ring-2 ring-ring',
      )}
    >
      {children}
    </button>
  );
}

export interface CaseSummaryProps {
  filters: CaseListFilters;
  onPick: (chip: SummaryChip) => void;
}

/** Counts of the scope (from the server) as clickable filters of the case list (F-12). */
export function CaseSummary({ filters, onPick }: CaseSummaryProps) {
  const { number } = useNumberFormat();
  const summary = useRcaSummary();
  if (!summary.data) {
    return summary.isError ? (
      <DataState state={dataStateOf(summary)} error={summary.error} onRetry={() => void summary.refetch()} />
    ) : (
      <Skeleton role="status" aria-label="Loading investigation counts" className="h-6 w-64" />
    );
  }
  const { total, overdue, critical, byStatus } = summary.data;
  const chip = { filters, onPick };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="case-summary" role="group" aria-label="Case counts (select to filter the list)">
      <Chip {...chip} chip={{ kind: 'all' }}>All investigations: {number(total)}</Chip>
      {byStatus.map((row) =>
        row.status ? (
          <Chip key={row.status} {...chip} chip={{ kind: 'status', status: row.status }} tone={toneOf(RCA_CASE_STATUS_TONES, row.status)}>
            {statusLabel(row.status)}: {number(row.count)}
          </Chip>
        ) : (
          <span key="none" className="text-xs text-muted-foreground">No status: {number(row.count)}</span>
        ),
      )}
      <Chip {...chip} chip={{ kind: 'overdue' }} tone={overdue > 0 ? 'danger' : 'neutral'}>
        Overdue: {number(overdue)}
      </Chip>
      <Chip {...chip} chip={{ kind: 'critical' }} tone={critical > 0 ? 'danger' : 'neutral'}>
        Open critical: {number(critical)}
      </Chip>
    </div>
  );
}
