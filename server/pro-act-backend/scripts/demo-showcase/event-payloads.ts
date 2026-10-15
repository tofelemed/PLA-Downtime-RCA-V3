/**
 * Request bodies of the generated events: stops, slowdowns and quality losses through the v2 event route;
 * the shift production report through the v1 route, the only one that records rejects
 * (`defectiveQuantity`, which the actuals engine reads as the shift's rejects). Coded stops name only the
 * reason (its defaults set schedule class, OEE component and impact); uncoded ones are left for the
 * operator queue and the declarative coding rules.
 */
import { GeneratedEvent } from './event-generator';
import { ShowcaseIds } from './showcase-context';
import { dec } from './showcase-random';
import { iso } from './showcase-window';

export interface PendingEvent {
  eventId: string;
  route: 'v2' | 'v1';
  body: Record<string, unknown>;
}

export function v2Payload(
  event: GeneratedEvent,
  unitId: string,
  unitKey: string,
  ids: ShowcaseIds,
  coded: boolean,
): PendingEvent {
  const body: Record<string, unknown> = {
    eventId: event.eventId,
    unitId,
    startTime: iso(event.start),
    endTime: iso(event.end),
    description: `Demo: ${coded ? event.description : uncodedText(event)}`,
  };
  const assetId = event.assetKind
    ? ids.assets.get(`${unitKey}:${event.assetKind}`)
    : undefined;
  if (assetId) body.assetId = assetId;
  const reasonId = ids.reasons.get(event.leaf.code);
  if (coded && reasonId) body.reasonCodeId = reasonId;
  if (event.kind === 'stop') {
    body.physicalType = 'downtime';
    body.eventType = 'ProductionLoss';
  } else if (event.kind === 'transition' && event.transition) {
    body.physicalType = 'grade_transition';
    body.scheduleClass = 'planned';
    body.oeeComponent = 'performance';
    body.fromProductId = ids.products.get(event.transition.fromCode);
    body.toProductId = ids.products.get(event.transition.toCode);
    body.quantity = dec(event.quantity ?? 0, 2);
    body.quantityUom = 't';
    delete body.reasonCodeId;
  } else if (event.kind === 'slowdown') {
    body.physicalType = 'slowdown';
    body.impactMode = 'fractional';
    body.impactFraction = dec(event.impactFraction ?? 0, 2);
  } else {
    body.physicalType = 'quality_loss';
    body.quantity = dec(event.quantity ?? 0, 2);
    body.quantityUom = 't';
  }
  return { eventId: event.eventId, route: 'v2', body };
}

function uncodedText(event: GeneratedEvent): string {
  if (event.kind !== 'stop') return event.description;
  const minutes = Math.round((event.end - event.start) / 60_000);
  return minutes < 5
    ? 'Line stopped briefly, restarted by operator'
    : 'Line stopped – cause to be confirmed';
}

export interface OutputInput {
  eventId: string;
  unitId: string;
  tenantId: string;
  start: number;
  end: number;
  shiftName: string;
  crew: string;
  operatorName: string;
  gross: number;
  rejects: number;
}

export function outputPayload(input: OutputInput): PendingEvent {
  return {
    eventId: input.eventId,
    route: 'v1',
    body: {
      eventId: input.eventId,
      unitId: input.unitId,
      tenantId: input.tenantId,
      eventType: 'ProductionOutput',
      status: 'Closed',
      source: 'Manual',
      description: `Demo: ${input.shiftName} shift production report (${input.crew})`,
      startTime: iso(input.start),
      endTime: iso(input.end),
      quantity: Number(input.gross.toFixed(2)),
      defectiveQuantity: Number(input.rejects.toFixed(2)),
      shift: input.shiftName,
      crew: input.crew,
      operatorName: input.operatorName,
    },
  };
}
