import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { PeriodAccountingView } from '@/api/v2/types/period-overview';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { humanize, labelOf, policyRefsLabel, REVISION_LIFECYCLE_LABELS, useUserNames } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { ToleranceBadge } from './tolerance-badge';

export interface PeriodHeaderProps {
  view: ReconciliationView;
  accounting: AnalyticsResponse<PeriodAccountingView> | null;
  unitName: string;
  planLabel: string;
  timezone: string;
  /** previous / next period links, beside the period's dates */
  neighbours?: ReactNode;
}

function CalculationDetails({ accounting, timezone }: { accounting: PeriodAccountingView['run']; timezone: string }) {
  if (!accounting) return <Badge variant="outline">Not calculated yet</Badge>;
  return (
    <>
      <Badge variant="outline" data-testid="run-badge">
        Calculated <PlantTime iso={accounting.completedAt ?? accounting.startedAt} tz={timezone} withDate />
      </Badge>
      <details className="text-xs text-muted-foreground" data-testid="calculation-details">
        <summary className="cursor-pointer">Details</summary>
        <p>Calculation engine {accounting.engineVersion}</p>
        <p>Policies: {policyRefsLabel(accounting.policyVersions)}</p>
      </details>
    </>
  );
}

/** Period scope, plan version, revision and lifecycle, when it was calculated and the tolerance; versions behind "Details". */
export function PeriodHeader({ view, accounting, unitName, planLabel, timezone, neighbours }: PeriodHeaderProps) {
  const users = useUserNames();
  const uom = view.slices[0]?.uom ?? null;
  const revision = view.revision;
  return (
    <header className="space-y-2" data-testid="period-header">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          <PlantTime iso={view.utcStart} tz={timezone} withDate /> → <PlantTime iso={view.utcEnd} tz={timezone} withDate />
        </h2>
        {neighbours}
      </div>
      <ScopeHeader scopeLabel={unitName} timezone={timezone} uom={uom} baseline={planLabel} isProvisional={revision.lifecycle !== 'approved'} asOf={accounting?.asOf ?? null} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" data-testid="revision-badge" data-lifecycle={revision.lifecycle}>
          Revision {revision.revision} · {labelOf(REVISION_LIFECYCLE_LABELS, revision.lifecycle)}
          {revision.isStale ? ' · inputs changed' : ''}
        </Badge>
        {view.publishedRevision !== null && <Badge variant="outline">Approved: revision {view.publishedRevision}</Badge>}
        <ToleranceBadge tolerance={view.tolerance} timezone={timezone} />
        <CalculationDetails accounting={accounting?.data.run ?? null} timezone={timezone} />
      </div>
      {revision.isStale && (
        <p className="text-sm text-destructive">Inputs changed after submission{revision.staleReason ? ` (${humanize(revision.staleReason).toLowerCase()})` : ''}: recompute and resubmit.</p>
      )}
      {revision.rejectReason && revision.lifecycle === 'draft' && (
        <p className="text-sm" data-testid="reject-reason">
          Returned by {users.nameOf(revision.rejectedBy)}: {revision.rejectReason}
        </p>
      )}
    </header>
  );
}
