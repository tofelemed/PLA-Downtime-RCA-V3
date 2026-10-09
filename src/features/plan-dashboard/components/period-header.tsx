import { Badge } from '@/components/ui/badge';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { PeriodAccountingView } from '@/api/v2/types/period-overview';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ScopeHeader } from '@/features/ux-kit/scope-header';

export interface PeriodHeaderProps {
  view: ReconciliationView;
  accounting: AnalyticsResponse<PeriodAccountingView> | null;
  unitName: string;
  planLabel: string;
  timezone: string;
}

const LIFECYCLE_LABELS: Record<string, string> = { draft: 'Draft', in_review: 'In review', approved: 'Approved', cancelled: 'Cancelled' };

/** Period scope, plan version, revision and lifecycle, run id, engine and policy versions (§16.2 header). */
export function PeriodHeader({ view, accounting, unitName, planLabel, timezone }: PeriodHeaderProps) {
  const run = accounting?.data.run ?? null;
  const uom = view.slices[0]?.uom ?? null;
  return (
    <header className="space-y-1" data-testid="period-header">
      <h2 className="text-lg font-semibold">
        <PlantTime iso={view.utcStart} tz={timezone} withDate /> → <PlantTime iso={view.utcEnd} tz={timezone} withDate />
      </h2>
      <ScopeHeader scopeLabel={unitName} timezone={timezone} uom={uom} baseline={planLabel} isProvisional={view.revision.lifecycle !== 'approved'} asOf={accounting?.asOf ?? null} />
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" data-testid="revision-badge" data-lifecycle={view.revision.lifecycle}>
          Revision {view.revision.revision} · {LIFECYCLE_LABELS[view.revision.lifecycle] ?? view.revision.lifecycle}
          {view.revision.isStale ? ' · stale' : ''}
        </Badge>
        {view.publishedRevision !== null && <Badge variant="outline">Published: revision {view.publishedRevision}</Badge>}
        <Badge variant="outline" title={view.baseRunId ?? undefined}>
          Run {view.baseRunId ? view.baseRunId.slice(0, 8) : 'none'}
          {run ? ` · ${run.engineVersion}` : ''}
        </Badge>
        {run?.policyVersions.map((p) => (
          <Badge key={p.id} variant="outline">
            {p.kind}@{p.version}
          </Badge>
        ))}
        <Badge variant="outline">
          Tolerance {view.tolerance.mode}
          {view.tolerance.mode === 'zero' ? '' : ` ${view.tolerance.value}`}
        </Badge>
      </div>
      {view.revision.isStale && <p className="text-sm text-destructive">Inputs changed after submission ({view.revision.staleReason ?? 'stale'}): recompute and resubmit.</p>}
      {view.revision.rejectReason && view.revision.lifecycle === 'draft' && <p className="text-sm">Returned by the reviewer: {view.revision.rejectReason}</p>}
    </header>
  );
}
