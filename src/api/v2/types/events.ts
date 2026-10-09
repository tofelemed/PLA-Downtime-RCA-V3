/** `ProductionEventV2View` (backend `src/v2/production-events/production-event-v2.view.ts`). */
export interface EventClassificationView {
  physicalType: string;
  scheduleClass: string;
  oeeComponent: string;
  impactMode: string;
  /** decimal string */
  impactFraction: string | null;
}

export interface EventStatesView {
  physical: string;
  coding: string;
  rca: string;
}

export interface ProductionEventView {
  id: string;
  canonicalId: string;
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
  sourceKind: string;
  severity: string | null;
  description: string | null;
  startTime: string;
  endTime: string | null;
  isOpen: boolean;
  /** seconds; null while open */
  durationSeconds: number | null;
  elapsedSeconds: number;
  asOf: string;
  classification: EventClassificationView;
  classificationBasis: string | null;
  impactCodeId: string | null;
  states: EventStatesView;
  /** decimal strings with explicit unit */
  quantity: string | null;
  quantityUom: string | null;
  cost: string | null;
  value: string | null;
  occurrenceId: string;
  supersededByEventId: string | null;
  rowVersion: number;
  overriddenFields?: string[];
}

export interface EventRevisionView {
  id: string;
  revision: number;
  kind: string;
  changeReason: string | null;
  actorId: string | null;
  actorKind: string;
  createdAt: string;
  effectiveFacts: Record<string, unknown>;
  sourceFacts: Record<string, unknown> | null;
}

/** `GET /production-events/{id}/revisions` (backend `production-event-history.view.ts`). */
export interface ProductionEventHistoryView {
  revisions: EventRevisionView[];
  coding: Array<Record<string, unknown>>;
  reviewItems: Array<Record<string, unknown>>;
  relations: Array<Record<string, unknown>>;
}
