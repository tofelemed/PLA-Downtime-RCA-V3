import { Link } from 'react-router-dom';
import { readinessQuery } from './readiness-model';
import { ReadinessFilterFields } from './readiness-filter-fields';
import type { ReactNode } from 'react';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { useEquipmentReadiness } from '@/api/v2/queries/equipment-readiness';
import { Button } from '@/components/ui/button';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { pageNameOf } from '@/features/auth/navigation-items';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { useOperationalDayStart } from '@/features/ux-kit/use-operational-day-start';
import { ReadinessContext } from './readiness-context';
import { ReadinessResults } from './readiness-results';
import { useReadinessFilters } from './use-readiness-filters';

const TITLE = 'Automatic readiness checks';
const READINESS_INFO =
  'Checks saved records, effective approvals and actual stored telemetry for the setup unit, for the product, mode and window chosen here (whole production days, at most 31). Updates on return and every minute while this page is visible. Passed refers to the named check; review the remaining evidence on its actual page; manual review and period evidence gates remain required. Nothing is saved or approved here.';

/** the guide's explanation, plus the production-day boundary when the plant's day does not start at midnight */
const readinessInfo = (dayStart: string | null) =>
  dayStart && dayStart !== '00:00' ? `${READINESS_INFO} Each production day runs from ${dayStart} to ${dayStart} the next day, named by the date it starts on.` : READINESS_INFO;

interface ReadinessHeaderProps {
  dayStart: string | null;
  canRefresh: boolean;
  fetching: boolean;
  onRefresh: () => void;
}

/** Title with its ⓘ; Open Pending approvals and Refresh checks on the right. */
function ReadinessHeader({ dayStart, canRefresh, fetching, onRefresh }: ReadinessHeaderProps) {
  return <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-1.5"><h2 className="font-semibold">{TITLE}</h2><KpiInfo label={TITLE} text={readinessInfo(dayStart)} /></div>
    <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
      <Button size="sm" variant="outline" asChild><Link to="/approvals">Open {pageNameOf('/approvals')}</Link></Button>
      <Button size="sm" variant="outline" disabled={!canRefresh} onClick={onRefresh}>{fetching ? 'Checking…' : 'Refresh checks'}</Button>
    </div>
  </div>;
}

function UnitReadiness({ unitId, storageKey, children }: { unitId: string; storageKey: string; children: ReactNode }) {
  const { timezone } = usePlantTimezone();
  const dayStart = useOperationalDayStart();
  const [filters, setFilters] = useReadinessFilters(storageKey, timezone, dayStart ?? '00:00');
  const query = dayStart === null ? null : readinessQuery(unitId, filters, { start: dayStart, timezone });
  const validWindow = query !== null;
  const readiness = useEquipmentReadiness(query);
  const snapshot = readiness.isError || !validWindow ? null : readiness.data ?? null;
  return <ReadinessContext.Provider value={snapshot}>
    <section aria-label="Automatic equipment readiness" className="space-y-4 rounded-lg border bg-card p-4">
      <ReadinessHeader dayStart={dayStart} canRefresh={validWindow && !readiness.isFetching} fetching={readiness.isFetching} onRefresh={() => void readiness.refetch()} />
      <ReadinessFilterFields filters={filters} onChange={setFilters} timezone={timezone} />
      {!validWindow && dayStart !== null && <p role="alert" className="text-sm text-destructive">Select an ordered window of at most 31 days.</p>}
      {readiness.isError && <FriendlyErrorAlert error={readiness.error} onRetry={() => void readiness.refetch()} />}
      {readiness.isFetching && <p role="status" className="text-sm text-muted-foreground">Reading saved configuration and telemetry…</p>}
      {snapshot && <ReadinessResults snapshot={snapshot} timezone={timezone} />}
    </section>
    {children}
  </ReadinessContext.Provider>;
}
/** Readiness checks for the unit chosen at the top of the guide; the step badges below read them from context. */
export function EquipmentReadiness({ unitId, children }: { unitId: string; children: ReactNode }) {
  const tenantId = useV2TenantId();
  const userId = useCurrentUserId();
  if (!unitId || !tenantId || !userId) return <>{children}</>;
  const storageKey = `proact:equipment-readiness:v2:${tenantId}:${userId}:${unitId}`;
  return <UnitReadiness key={storageKey} unitId={unitId} storageKey={storageKey}>{children}</UnitReadiness>;
}
