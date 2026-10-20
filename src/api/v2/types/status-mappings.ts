/**
 * Source status mappings (backend `src/v2/close/source-status-mappings-v2.controller.ts`, SME R13): per
 * source system, versioned rules saying which source statuses are the released (authorised final) record.
 * Instants are ISO 8601 UTC.
 */
export type StatusMappingState = 'draft' | 'approved' | 'retired';

export interface SourceStatusEntry {
  status: string;
  released: boolean;
}

export interface SourceStatusMappingView {
  id: string;
  sourceSystem: string;
  version: number;
  state: StatusMappingState;
  statuses: SourceStatusEntry[];
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string | null;
  createdByName: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  /** item 1.3: server-derived SuperAdmin self-decision (owner decision 2026-10-16); absent from older servers */
  selfDecided?: boolean;
  /** the approved version imports of this source use now (server-decided) */
  inForce: boolean;
  notes: string | null;
}

/** `POST /source-status-mappings` (SourceStatusMappingCreateDto): only declared fields. */
export interface SourceStatusMappingCreateBody {
  sourceSystem: string;
  effectiveFrom: string;
  statuses: SourceStatusEntry[];
  notes?: string;
}
