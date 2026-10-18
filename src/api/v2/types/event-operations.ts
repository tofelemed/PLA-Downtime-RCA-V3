import type { ProductionEventView } from './events';

/**
 * Results of the plan 1.4 event operations (backend `event-operation.view.ts`, `bulk-code.types.ts`);
 * mirrored by hand because the OpenAPI snapshot has no response schemas (plan 3.1 decision).
 */
export interface EventOperationView {
  operation: 'split' | 'merge' | 'close';
  createdEventIds: string[];
  supersededEventIds: string[];
  updatedEventIds: string[];
  occurrenceId: string;
  events: ProductionEventView[];
}

export interface CodingSnapshotView {
  reasonCodeId: string | null;
  impactCodeId: string | null;
  scheduleClass: string;
  oeeComponent: string;
  codingState: string;
  /** A-1: asset before / after a bulk change (absent on older servers) */
  assetId?: string | null;
  /** SME D12 (absent on older servers) */
  investigationPending?: boolean;
}

export type BulkExclusionReason = 'not_found' | 'duplicate' | 'superseded' | 'retracted' | 'stale_version';

export interface BulkExclusionView {
  eventId: string;
  reason: BulkExclusionReason;
  currentVersion?: number;
}

export interface AffectedWindowView {
  unitId: string;
  from: string;
  to: string | null;
}

/** `bulk-code` with `preview: true`. */
export interface BulkCodePreviewView {
  count: number;
  items: Array<{ eventId: string; before: CodingSnapshotView; after: CodingSnapshotView }>;
  exclusions: BulkExclusionView[];
  affectedWindows: AffectedWindowView[];
}

/** `bulk-code` applied synchronously (≤ 500 events). */
export interface BulkCodeAppliedView {
  applied: number;
  events: Array<{ eventId: string; rowVersion: number }>;
}

export type BulkJobState = 'queued' | 'running' | 'completed' | 'partial' | 'failed';

export interface BulkJobChunkView {
  index: number;
  size: number;
  state: 'completed' | 'failed';
  errorCode?: string;
  errorMessage?: string;
}

/** `GET /jobs/{id}` (API04). */
export interface BulkJobView {
  id: string;
  kind: string;
  state: BulkJobState;
  total: number;
  processed: number;
  failed: number;
  chunks: BulkJobChunkView[];
  requestedBy: string | null;
  createdAt: string;
  finishedAt: string | null;
}
