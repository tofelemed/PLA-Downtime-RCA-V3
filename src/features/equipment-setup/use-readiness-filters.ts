import { useEffect, useState } from 'react';
import { DAY_MS, MINUTE_MS, rollingWindow } from '@/api/v2/queries/time-window';
import { validReadinessRange, type ReadinessFilters } from './readiness-model';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function readFilters(key: string): ReadinessFilters {
  const fallback = { productId: '', operatingMode: 'normal', range: rollingWindow(DAY_MS, Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS) };
  try {
    const row = JSON.parse(sessionStorage.getItem(key) ?? 'null') as ReadinessFilters | null;
    if (!row || (row.productId !== '' && !uuid.test(row.productId)) || typeof row.operatingMode !== 'string' || row.operatingMode.length > 64) return fallback;
    return validReadinessRange(row.range) ? row : fallback;
  } catch { return fallback; }
}
/** Caller keys this component by user/plant/unit; only filter preferences are stored, never readiness. */
export function useReadinessFilters(key: string) {
  const [filters, setFilters] = useState(() => readFilters(key));
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(filters)); } catch { /* In-memory filters still work. */ } }, [key, filters]);
  return [filters, setFilters] as const;
}
