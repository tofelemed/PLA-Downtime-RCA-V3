import { useMemo, type ReactNode } from 'react';
import { useAllCodes } from '@/api/v2/queries/reference-data';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { UnitView } from '@/api/v2/types/units';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { codeNameResolver } from './model/code-names';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';

const nameOf = <T extends { id: string }>(rows: readonly T[], label: (row: T) => string) => {
  const byId = new Map(rows.map((row) => [row.id, label(row)]));
  return (id: string | null | undefined) => (id ? byId.get(id) ?? 'Unknown' : '—');
};

/** C-10: a unit's code as secondary text, only when master data gives it a name of its own. */
const distinctCodeOf = (rows: readonly UnitView[]) => {
  const byId = new Map(rows.filter((unit) => unit.code && unit.code !== unit.name).map((unit) => [unit.id, unit.code]));
  return (id: string | null | undefined) => (id ? byId.get(id) ?? null : null);
};

export function EventHubEnvProvider({ tenantId, children }: { tenantId: string; children: ReactNode }) {
  const zone = usePlantTimezone();
  const units = useUnits();
  const reasons = useAllCodes('reason-codes', { includeRetired: true });
  const value = useMemo<EventHubEnv>(() => {
    const unitRows = flattenPages(units.data?.pages);
    const allReasons = flattenPages(reasons.data?.pages);
    const reasonRows = allReasons.filter((code) => code.active);
    return {
      tenantId,
      timezone: zone.timezone,
      timezoneIsFallback: zone.source === 'utc-fallback',
      units: unitRows,
      unitsLoading: units.isLoading,
      reasonCodes: reasonRows,
      allReasonCodes: allReasons,
      unitName: nameOf(unitRows, (unit) => unit.name),
      unitCode: distinctCodeOf(unitRows),
      reasonName: codeNameResolver(allReasons, reasons.complete || reasons.isError),
    };
  }, [tenantId, zone.timezone, zone.source, units.data, units.isLoading, reasons.data, reasons.complete, reasons.isError]);
  return <EventHubEnvContext.Provider value={value}>{children}</EventHubEnvContext.Provider>;
}
