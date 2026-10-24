import { useSearchParams } from 'react-router-dom';
import { useCapacityGapReport } from '@/api/v2/queries/capacity-gap';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '../components/analytics-card';
import type { AnalyticsScope } from '../model/analytics-scope';
import { CapacityGapFilters } from './capacity-gap-filters';
import { capacityGapQueryOf, CHAIN_KINDS, KIND_DEFINITIONS, kindLabel, parseCapacityFilters, REFERENCE_KINDS, type CapacityGapFilters as Filters } from './capacity-gap-model';
import { CapacityGapTable } from './capacity-gap-table';

export interface CapacityGapPageProps {
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * Capacity gap (plan 1.2, D-T1): the approved rate kinds of each unit and product side by side, with the
 * gaps and ratios as the server computed them. Nothing is inferred for a missing kind ("not set"), kinds
 * are never added together and different units of measure or timebases are never converted.
 */
export function CapacityGapPage({ scope, onChange }: CapacityGapPageProps) {
  const env = useEventHubEnv();
  const [params, setParams] = useSearchParams();
  const filters = parseCapacityFilters(params);
  const query = useCapacityGapReport(capacityGapQueryOf(scope.unitIds, filters, env.timezone));
  const data = query.data;
  const setFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    const search = new URLSearchParams(params);
    if (next.productIds.length > 0) search.set('products', next.productIds.join(','));
    else search.delete('products');
    if (next.asOf) search.set('asOf', next.asOf);
    else search.delete('asOf');
    setParams(search, { replace: true });
  };
  return (
    <div className="space-y-4" data-testid="pla-capacity-gap">
      <CapacityGapFilters unitIds={scope.unitIds} filters={filters} onUnits={(unitIds) => onChange({ unitIds })} onFilters={setFilters} />
      <AnalyticsCard
        title="Approved rates and gaps"
        testId="capacity-gap-card"
        query={query}
        response={undefined}
        isEmpty={data?.items.length === 0}
        emptyText="No approved production profile is in force for these units and products at this date."
        info={<KindDefinitionsInfo />}
      >
        {data && <CapacityGapTable rows={data.items} />}
        {data?.truncated && <p className="text-xs text-muted-foreground" data-testid="capacity-gap-truncated">Only the first {data.limit} profiles are shown: choose units or products to narrow the report.</p>}
      </AnalyticsCard>
    </div>
  );
}

/** The rate kinds and how the gaps are read: the card's ⓘ (no definitions box on the page). */
export function KindDefinitionsInfo() {
  return (
    <div className="space-y-1" data-testid="capacity-gap-definitions">
      <ul>
        {[...CHAIN_KINDS, ...REFERENCE_KINDS].map((kind) => (
          <li key={kind}><span className="font-medium">{kindLabel(kind)}</span>: {KIND_DEFINITIONS[kind]}</li>
        ))}
      </ul>
      <p>
        Only approved, effective-dated rate versions in force at the As of date are used. Each gap is the upper kind minus the next one (ratio = gap ÷ upper kind); a kind without an approved version reads “not set” and nothing is estimated for it. Kinds are shown side by side, never added together, and different units or timebases are never converted.
      </p>
    </div>
  );
}
