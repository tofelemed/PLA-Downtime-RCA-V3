import { ProductionEvent } from '../../production-event/production-event.entity';
import { toDecimalString } from '../common/decimal-string.transformer';

/** v2 read model over the existing `production_events` row; decimals are strings, times ISO 8601 UTC. */
export interface ProductionEventV2View {
  id: string;
  eventId: string | null;
  tenantId: string | null;
  unitId: string;
  assetId: string | null;
  planId: string | null;
  reasonCodeId: string | null;
  rcaId: string | null;
  eventType: string | null;
  status: string | null;
  source: string | null;
  severity: string | null;
  description: string | null;
  startTime: string;
  endTime: string | null;
  isOpen: boolean;
  duration: string | null;
  quantity: string | null;
  cost: string | null;
  value: string | null;
}

export function toProductionEventV2View(
  event: ProductionEvent,
): ProductionEventV2View {
  return {
    id: event.id,
    eventId: event.eventId ?? null,
    tenantId: event.tenantId ?? null,
    unitId: event.unitId,
    assetId: event.assetId ?? null,
    planId: event.planId ?? null,
    reasonCodeId: event.reasonCodeId ?? null,
    rcaId: event.rcaId ?? null,
    eventType: event.eventType ?? null,
    status: event.status ?? null,
    source: event.source ?? null,
    severity: event.severity ?? null,
    description: event.description ?? null,
    startTime: toIso(event.startTime) ?? '',
    endTime: toIso(event.endTime),
    isOpen: event.endTime === null || event.endTime === undefined,
    duration: toDecimalString(event.duration),
    quantity: toDecimalString(event.quantity),
    cost: toDecimalString(event.cost),
    value: toDecimalString(event.value),
  };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
