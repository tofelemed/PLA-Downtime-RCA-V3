import { useEffect, useState } from 'react';
import { lastPlantDay, validReadinessRange, type ReadinessFilters } from './readiness-model';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function readFilters(key: string, timezone: string, dayStart: string): ReadinessFilters {
  const fallback = { productId: '', operatingMode: 'normal', range: lastPlantDay(timezone, Date.now(), dayStart) };
  try {
    const row = JSON.parse(sessionStorage.getItem(key) ?? 'null') as ReadinessFilters | null;
    if (!row || (row.productId !== '' && !uuid.test(row.productId)) || typeof row.operatingMode !== 'string' || row.operatingMode.length > 64) return fallback;
    return validReadinessRange(row.range) ? row : fallback;
  } catch { return fallback; }
}
/** Caller keys this component by user/plant/unit; only filter preferences are stored, never readiness. */
export function useReadinessFilters(key: string, timezone: string, dayStart: string) {
  const [filters, setFilters] = useState(() => readFilters(key, timezone, dayStart));
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(filters)); } catch { /* In-memory filters still work. */ } }, [key, filters]);
  return [filters, setFilters] as const;
}
