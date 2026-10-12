import { Badge } from '@/components/ui/badge';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { PeriodAccountingView } from '@/api/v2/types/period-overview';
import type { ReconciliationView, ToleranceView } from '@/api/v2/types/reconciliation';
import { humanize, labelOf, policyRefsLabel, REVISION_LIFECYCLE_LABELS, useUserNames } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ScopeHeader } from '@/features/ux-kit/scope-header';

export interface PeriodHeaderProps {
  view: ReconciliationView;
  accounting: AnalyticsResponse<PeriodAccountingView> | null;
  unitName: string;
  planLabel: string;
  timezone: string;
}

const toleranceText = (t: ToleranceView) => (t.mode === 'zero' ? 'Tolerance: none' : t.mode === 'percent' ? `Tolerance: ${t.value} %` : `Tolerance: ${t.value}`);

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
export function PeriodHeader({ view, accounting, unitName, planLabel, timezone }: PeriodHeaderProps) {
  const users = useUserNames();
  const uom = view.slices[0]?.uom ?? null;
  const revision = view.revision;
  return (
    <header className="space-y-2" data-testid="period-header">
      <h2 className="text-lg font-semibold">
        <PlantTime iso={view.utcStart} tz={timezone} withDate /> → <PlantTime iso={view.utcEnd} tz={timezone} withDate />
      </h2>
      <ScopeHeader scopeLabel={unitName} timezone={timezone} uom={uom} baseline={planLabel} isProvisional={revision.lifecycle !== 'approved'} asOf={accounting?.asOf ?? null} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" data-testid="revision-badge" data-lifecycle={revision.lifecycle}>
          Revision {revision.revision} · {labelOf(REVISION_LIFECYCLE_LABELS, revision.lifecycle)}
          {revision.isStale ? ' · inputs changed' : ''}
        </Badge>
        {view.publishedRevision !== null && <Badge variant="outline">Approved: revision {view.publishedRevision}</Badge>}
        <Badge variant="outline">{toleranceText(view.tolerance)}</Badge>
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
