import type { GridWorkflowState } from './period-overview';

/** `ProductionEventV2View` (backend `src/v2/production-events/production-event-v2.view.ts`). */
export interface EventClassificationView {
  physicalType: string;
  scheduleClass: string;
  oeeComponent: string;
  impactMode: string;
  /** decimal string */
  impactFraction: string | null;
  /** plan 1.10: `stated` (a person's value, the override), `default`, `unit_rule` or `standby_takeover`; absent on older servers */
  impactBasis?: string;
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

/** D-T5: one reason of a weighted stop; `weight` is an 8-place decimal string, the weights add up to 1. */
export interface ReasonWeightView {
  reasonCodeId: string;
  weight: string;
  /** declared mode (Task 13): a recovery share of a production loss (Σ loss − Σ recovery = 1) */
  recovery?: boolean;
  /** declared mode: the share in the event's unit (shortfall × weight, server-computed); absent for a stop */
  quantity?: string | null;
}

/** D-T5: a reason as the coder enters it on PATCH — a percent (decimal string) or seconds, one of the two. */
export interface ReasonWeightInput {
  reasonCodeId: string;
  percent?: string;
  seconds?: number;
  /** declared mode: tonnes of a production_loss event (they add up to the event quantity) */
  quantity?: string;
  /** declared mode: this share is a recovery (Σ loss − Σ recovery = the shortfall; percent: = 100) */
  recovery?: boolean;
}

/** Declared mode: the figures OT declares for a `production_loss` event (the event quantity is the shortfall). */
export interface DeclaredFigures {
  planned: number | null;
  actual: number | null;
  shortfall: number;
  uom: string;
  measurementQuality: string | null;
  /** OT status, e.g. `DETECTED` | `CONFIRMED` */
  sourceStatus: string | null;
  plan: { source: string | null; planId: string | null; revision: number | null; approved: boolean | null } | null;
  piSource: { actualTag: string | null; eventFrameId: string | null } | null;
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
  /**
   * D-T5: the reasons the stop is split across, largest first (the first is `reasonCodeId`); null / absent =
   * `reasonCodeId` alone
   */
  reasonWeights?: ReasonWeightView[] | null;
  /** declared mode: present on `production_loss` events; null / absent = none */
  declaredFigures?: DeclaredFigures | null;
  /** SME D12: explicitly under investigation (no specific reason yet) */
  investigationPending?: boolean;
  /** SME D13: supervisor verification of the coding, maintenance validation of the failure detail */
  verification?: {
    verifiedBy: string | null;
    verifiedAt: string | null;
    validatedBy: string | null;
    validatedAt: string | null;
  };
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
  /** absent for a caller without the money capability (operators, QA re-test 2026-10-19) */
  cost?: string | null;
  value: string | null;
  occurrenceId: string;
  supersededByEventId: string | null;
  rowVersion: number;
  overriddenFields?: string[];
  /**
   * E-5 (single event reads only): PATCH field names the source system owns — the interval of a non-manual
   * event (`startTime`, `endTime`, `durationSeconds`: PATCH answers 409 SOURCE_OWNED) and, once a source
   * revision exists, the fields whose edit is recorded as a source override. `[]` for manual events.
   */
  sourceOwnedFields?: string[];
  /** SME D5: repeat-stop incident of the occurrence (list and single reads); null / absent = none */
  incidentId?: string | null;
  /**
   * Owner finding 2 (list and single reads): accounting workflow of the periods the event overlaps
   * (open work wins); shown next to the coding state, never instead of it. Absent on older servers.
   */
  accountingState?: GridWorkflowState;
  /** Task 13: the first production period the event overlaps ("View accounting"); null / absent = none yet */
  accountingPeriod?: EventAccountingPeriodView | null;
}

export interface EventRevisionView {
  id: string;
  revision: number;
  kind: string;
  changeReason: string | null;
  actorId: string | null;
  actorKind: string;
  /** owner finding 1: service key (`state-engine`, …) or connector / import source name of a non-user revision; absent on older servers */
  actorSource?: string | null;
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
  /** owner finding 1: the service or source of a coding revision without a person; absent on older servers */
  authorSource?: string | null;
  createdAt: string;
}

export type ReviewItemState = 'open' | 'kept_override' | 'accepted_source' | 'dismissed';
/** Backend `REVIEW_ITEM_KINDS` (event_review_item_kind). */
export type ReviewItemKind =
  | 'source_vs_override_conflict'
  | 'late_correction'
  | 'retraction'
  | 'pending_source_confirmation'
  | 'declared_identity_mismatch'
  | 'declared_window_mismatch'
  | 'duplicate_declared_loss'
  | 'source_reason_changed';

/** A decision owed on an event (backend `EventReviewItemView`, spec §5.3). */
export interface EventReviewItemView {
  id: string;
  eventId: string;
  kind: ReviewItemKind;
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

/** One currency's value of the loss an event carries in one period revision (backend `AttributedValueV2View`). */
export interface AttributedValueView {
  currency: string;
  /** decimal string; null when any line is not valued or lacks an FX rate (never estimated) */
  amount: string | null;
  valuedLines: number;
  unvaluedLines: number;
  /** valued lines converted with an authorised provisional FX rate */
  provisionalLines: number;
  status: 'valued' | 'unvalued' | 'mixed';
  fxProvisional: boolean;
}

export interface AttributedQuantityView {
  kind: string;
  uom: string | null;
  /** signed decimal string */
  quantity: string;
  lines: number;
}

/** The loss one event carries in one period revision (UX G-2b, backend `AttributedPeriodV2View`). */
export interface AttributedPeriodView {
  periodId: string;
  unitId: string;
  localDate: string;
  shiftName: string | null;
  utcStart: string;
  utcEnd: string;
  /** plan of the period's accounting-baseline plan version (null = profile default product) */
  planId: string | null;
  planVersionId: string | null;
  revisionId: string;
  revision: number;
  /** approved | draft | in_review */
  lifecycle: string;
  /** approved = the published revision's lines; provisional = the open revision's run proposals */
  status: 'approved' | 'provisional';
  quantities: AttributedQuantityView[];
  /** absent for a caller without the money capability (operators, QA re-test 2026-10-19) */
  values?: AttributedValueView[];
}

/** `GET /v2/production-events/{id}/attributed-losses` (backend `EventAttributedLossesV2View`). */
export interface EventAttributedLossesView {
  eventId: string;
  /**
   * the valuation view of `values`: the view frozen when the event's periods were approved, else the tenant
   * policy's default basis; absent without the money capability
   */
  valuationView?: string;
  /** where `valuationView` comes from */
  valuationViewSource?: 'approved_snapshot' | 'policy_default';
  items: AttributedPeriodView[];
  /** more periods than the server bound (200) carried this event; the earliest are listed */
  truncated: boolean;
  asOf: string;
}

/** Task 13: the accounting period of an event (backend `EventAccountingPeriodView`). */
export interface EventAccountingPeriodView {
  periodId: string;
  utcStart: string;
  utcEnd: string;
  localDate: string;
  shiftName: string | null;
}
