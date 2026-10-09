import { useMemo, type ReactNode } from 'react';
import { useCodeLibrary } from '@/api/v2/queries/reference-data';
import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { EventHubEnvContext, type EventHubEnv } from './use-event-hub-env';

const nameOf = <T extends { id: string }>(rows: readonly T[], label: (row: T) => string) => {
  const byId = new Map(rows.map((row) => [row.id, label(row)]));
  return (id: string | null | undefined) => (id ? byId.get(id) ?? 'Unknown' : '—');
};

export function EventHubEnvProvider({ tenantId, children }: { tenantId: string; children: ReactNode }) {
  const zone = usePlantTimezone();
  const units = useUnits();
  const reasons = useCodeLibrary('reason-codes');
  const value = useMemo<EventHubEnv>(() => {
    const unitRows = flattenPages(units.data?.pages);
    const reasonRows = flattenPages(reasons.data?.pages).filter((code) => code.active);
    return {
      tenantId,
      timezone: zone.timezone,
      timezoneIsFallback: zone.source === 'utc-fallback',
      units: unitRows,
      unitsLoading: units.isLoading,
      reasonCodes: reasonRows,
      unitName: nameOf(unitRows, (unit) => unit.name),
      reasonName: nameOf(reasonRows, (code) => `${code.code} · ${code.name}`),
    };
  }, [tenantId, zone.timezone, zone.source, units.data, units.isLoading, reasons.data]);
  return <EventHubEnvContext.Provider value={value}>{children}</EventHubEnvContext.Provider>;
}
