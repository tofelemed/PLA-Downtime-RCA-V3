import {
  CodingState,
  OeeComponent,
  ScheduleClass,
} from '../domain/events/event-classification';

/** Largest batch applied synchronously and atomically (DT10); larger batches become a job (API04). */
export const ATOMIC_BULK_LIMIT = 500;
/** Events per atomic chunk of a bulk job. */
export const BULK_CHUNK_SIZE = 200;

export interface BulkCodeItem {
  eventId: string;
  expectedVersion: number;
}

/** Codes applied to every event; a reason code brings its classification defaults (plan 1.3). */
export interface BulkCodes {
  reasonCodeId?: string;
  scheduleClass?: ScheduleClass;
  oeeComponent?: OeeComponent;
  /** UX A-1: equipment of the events' unit (a source override on source events, like a single PATCH) */
  assetId?: string;
  /** UX E-3 / SME D12: explicitly under investigation (no specific reason yet) */
  investigationPending?: boolean;
}

export interface BulkCodeCommand {
  items: BulkCodeItem[];
  codes: BulkCodes;
  reason: string;
}

/** Coding of one event before or after the bulk command. */
export interface CodingSnapshot {
  reasonCodeId: string | null;
  assetId: string | null;
  investigationPending: boolean;
  impactCodeId: string | null;
  scheduleClass: ScheduleClass;
  oeeComponent: OeeComponent;
  codingState: CodingState;
}

export type BulkExclusionReason =
  | 'not_found'
  | 'duplicate'
  | 'superseded'
  | 'retracted'
  | 'stale_version';

export interface BulkExclusion {
  eventId: string;
  reason: BulkExclusionReason;
  /** stale versions: the version to read again */
  currentVersion?: number;
}

/** A window the command touches (until Phase 2 periods exist): per unit, merged; open end = null. */
export interface AffectedWindow {
  unitId: string;
  from: string;
  to: string | null;
}

export interface BulkCodePreview {
  /** eligible events (not excluded); the apply covers these */
  count: number;
  /** eligible events whose coding the command actually changes (an unchanged event gets no revision) */
  changedCount: number;
  items: Array<{
    eventId: string;
    before: CodingSnapshot;
    after: CodingSnapshot;
    /** the coding after differs from the coding before */
    changed: boolean;
  }>;
  exclusions: BulkExclusion[];
  affectedWindows: AffectedWindow[];
}

export interface BulkCodeApplied {
  applied: number;
  events: Array<{ eventId: string; rowVersion: number }>;
}
