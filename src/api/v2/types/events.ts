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

/** SME D13: an event of a bulk action — what bulk coding sends and its preview names. */
export type BulkTarget = Pick<ProductionEventView, 'id' | 'rowVersion' | 'unitId' | 'startTime' | 'endTime'>;

/** `GET /v2/production-events/selection`: the matching events as a versioned snapshot (SME D13). */
export interface EventSelectionView {
  count: number;
  firstStart: string | null;
  lastEnd: string | null;
  unitIds: string[];
  assetCount: number;
  items: Array<BulkTarget & { assetId: string | null }>;
}

export interface ProductionEventView {
  id: string;
  canonicalId: string;
  eventId: string | null;
  tenantId: string | null;
  unitId: string;
  assetId: string | null;
  /** SME D3: unit / asset whose failure caused this stop; null = the event's own unit */
  originUnitId: string | null;
  originAssetId: string | null;
  /** SME D4: approved end of a planned stop's window */
  plannedEndTime: string | null;
  /** SME D8 / D11: failure detail (ISO 14224); null = not determined yet */
  failure?: {
    mode: string | null;
    severity: string | null;
    maintainableItem: string | null;
    mechanism: string | null;
    cause: string | null;
    detectionMethod: string | null;
  };
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
  /** SME E3: disposition of a quality_loss event's tonnes (downgrade / scrap / rework); absent / null = none */
  dispositionClass?: string | null;
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
  sourceRevision: string | null;
  createdAt: string;
  effectiveFacts: Record<string, unknown>;
  sourceFacts: Record<string, unknown> | null;
}

/** One coding revision (backend `EventCodingView`). */
export interface EventCodingView {
  id: string;
  revision: number;
  reasonCodeId: string | null;
  impactCodeId: string | null;
  oeeCodeId: string | null;
  scheduleClass: string;
  oeeComponent: string;
  impactMode: string;
  impactFraction: string | null;
  comment: string | null;
  isOverride: boolean;
  reason: string | null;
  authorId: string | null;
  createdAt: string;
}

export type ReviewItemState = 'open' | 'kept_override' | 'accepted_source' | 'dismissed';

/** A decision owed on an event (backend `EventReviewItemView`, spec §5.3). */
export interface EventReviewItemView {
  id: string;
  eventId: string;
  kind: string;
  field: string | null;
  state: ReviewItemState;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** Lineage row (backend `EventRelationView`): split_child_of / merged_from. */
export interface EventRelationView {
  id: string;
  relationType: string;
  fromEventId: string;
  toEventId: string;
  occurrenceId: string | null;
  createdAt: string;
}

/** `GET /production-events/{id}/revisions` (backend `production-event-history.view.ts`). */
export interface ProductionEventHistoryView {
  revisions: EventRevisionView[];
  coding: EventCodingView[];
  reviewItems: EventReviewItemView[];
  relations: EventRelationView[];
}
