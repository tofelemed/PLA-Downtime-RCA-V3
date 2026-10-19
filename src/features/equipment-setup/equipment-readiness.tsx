import { Link } from 'react-router-dom';
import { readinessQuery } from './readiness-model';
import { ReadinessFilterFields } from './readiness-filter-fields';
import type { ReactNode } from 'react';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { useEquipmentReadiness } from '@/api/v2/queries/equipment-readiness';
import { Button } from '@/components/ui/button';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { pageNameOf } from '@/features/auth/navigation-items';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { useOperationalDayStart } from '@/features/ux-kit/use-operational-day-start';
import { useEquipmentJourney } from './journey-context';
import { ReadinessContext } from './readiness-context';
import { ReadinessResults } from './readiness-results';
import { useReadinessFilters } from './use-readiness-filters';
import type { SetupJourney } from './journey-storage';

function UnitReadiness({ journey, storageKey, children }: { journey: SetupJourney; storageKey: string; children: ReactNode }) {
  const { timezone } = usePlantTimezone();
  const dayStart = useOperationalDayStart();
  const [filters, setFilters] = useReadinessFilters(storageKey, timezone, dayStart ?? '00:00');
  const query = dayStart === null ? null : readinessQuery(journey, filters, { start: dayStart, timezone });
  const validWindow = query !== null;
  const readiness = useEquipmentReadiness(query);
  const snapshot = readiness.isError || !validWindow ? null : readiness.data ?? null;
  return <ReadinessContext.Provider value={snapshot}>
    <section aria-label="Automatic equipment readiness" className="space-y-4 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Automatic readiness checks</h2><Button size="sm" variant="outline" disabled={!validWindow || readiness.isFetching} onClick={() => void readiness.refetch()}>{readiness.isFetching ? 'Checking…' : 'Refresh checks'}</Button></div>
      <p className="text-sm text-muted-foreground">Check saved records, effective approvals and actual stored telemetry for the setup unit. Updates on return and every minute while this page is visible. Passed refers to the named check; review the remaining evidence on its actual page. Nothing is saved or approved here.</p>
      <Button size="sm" variant="link" asChild><Link to="/approvals">Open {pageNameOf('/approvals')}</Link></Button>
      <ReadinessFilterFields filters={filters} onChange={setFilters} timezone={timezone} dayStart={dayStart} />
      {!validWindow && dayStart !== null && <p role="alert" className="text-sm text-destructive">Select an ordered window of at most 31 days.</p>}
      {readiness.isError && <FriendlyErrorAlert error={readiness.error} onRetry={() => void readiness.refetch()} />}
      {readiness.isFetching && <p role="status" className="text-sm text-muted-foreground">Reading saved configuration and telemetry…</p>}
      {snapshot && <ReadinessResults snapshot={snapshot} timezone={timezone} />}
    </section>
    {children}
  </ReadinessContext.Provider>;
}
export function EquipmentReadiness({ children }: { children: ReactNode }) {
  const journey = useEquipmentJourney()?.journey;
  const tenantId = useV2TenantId();
  const userId = useCurrentUserId();
  if (!journey?.unitId || !tenantId || !userId) return <><p className="text-sm text-muted-foreground">Choose the setup production unit to see automatic readiness checks.</p>{children}</>;
  const storageKey = `proact:equipment-readiness:v2:${tenantId}:${userId}:${journey.unitId}`;
  return <UnitReadiness key={storageKey} journey={journey} storageKey={storageKey}>{children}</UnitReadiness>;
}
