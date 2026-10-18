import type { EquipmentReadinessQuery } from '@/api/v2/queries/equipment-readiness';
import { DAY_MS } from '@/api/v2/queries/time-window';
import type { ReadinessCheckView, ReadinessStatus } from '@/api/v2/types/equipment-readiness';
import type { InstantRange } from '@/features/ux-kit/date-inputs';
import type { SetupJourney } from './journey-storage';

export interface ReadinessFilters { productId: string; operatingMode: string; range: InstantRange }
export const STATUS_LABELS: Record<ReadinessStatus, string> = { ready: 'Passed', missing: 'Missing', needs_attention: 'Needs attention', not_checked: 'Not checked', optional: 'Optional' };
export function stepReadiness(checks: ReadinessCheckView[]): ReadinessStatus {
  if (!checks.length) return 'not_checked';
  for (const status of ['missing', 'needs_attention', 'not_checked', 'optional'] as const) if (checks.some((check) => check.status === status)) return status;
  return 'ready';
}
export function validReadinessRange(range: InstantRange): boolean {
  if (!range) return false;
  const span = Date.parse(range.to ?? '') - Date.parse(range.from ?? '');
  return span > 0 && span <= 31 * DAY_MS;
}
export function readinessQuery(journey: SetupJourney, filters: ReadinessFilters): EquipmentReadinessQuery | null {
  const { from, to } = filters.range;
  if (!from || !to || !validReadinessRange(filters.range)) return null;
  return { unitId: journey.unitId, productId: filters.productId || undefined, operatingMode: filters.operatingMode, from, to, connectionId: journey.connectionId || undefined, planId: journey.planId || undefined, periodId: journey.periodId || undefined };
}
