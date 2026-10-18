/**
 * Source authority versions (backend `src/v2/source-authority/source-authority-v2.view.ts`, D05 / SME E7):
 * which measurement source counts for a unit's output, with its ranked measurement hierarchy. Versions are
 * maker-checker (owner, 15 Oct 2026): a draft applies only once production accounting approves it.
 * Instants are ISO 8601 UTC.
 */
export type SourceAuthorityVersionState = 'proposed' | 'approved' | 'rejected';

/** How a record at another boundary is brought to the slice boundary (SME E7). */
export interface BoundaryAdjustmentView {
  inventoryChangeAccounted: boolean;
  lagSeconds: number;
  evidenceRef: string;
}

export interface SourceHierarchyEntry {
  rank: number;
  sourceClass: string | null;
  source: string;
  signalSourceKey: string | null;
  boundary: string | null;
  boundaryAdjustment?: BoundaryAdjustmentView | null;
}

export interface SourceAuthorityPolicyView {
  measurement: string;
  primarySource: string;
  fallback: { conditions: string[]; source: string } | null;
  measurementHierarchy?: { boundary: string; conditions: string[]; entries: SourceHierarchyEntry[] };
}

/** `GET /source-authority?unitId=`: the version in force for a unit (its own, else tenant-wide). */
export interface SourceAuthorityInForceView {
  policyId: string;
  version: number;
  unitId: string | null;
  effectiveFrom: string;
  notes: string | null;
  policy: SourceAuthorityPolicyView;
}

/** `GET /source-authority/versions` item. */
export interface SourceAuthorityVersionView {
  id: string;
  version: number;
  /** null = tenant-wide */
  unitId: string | null;
  state: SourceAuthorityVersionState;
  /** approved and in force now for its scope (server-decided) */
  inForce: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  basedOnId: string | null;
  createdBy: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  /** commissioning backdate: the past instant it takes effect from on approval, and why (null = approval time) */
  requestedEffectiveFrom: string | null;
  backdateReason: string | null;
  policy: SourceAuthorityPolicyView;
}

/** `POST /source-authority/versions` (SourceAuthorityVersionDto): only declared fields. */
export interface SourceAuthorityDraftBody {
  /** absent = the plant-wide version */
  unitId?: string;
  measurementHierarchy: {
    boundary: string;
    conditions: string[];
    entries: Array<{
      rank: number;
      sourceClass: string;
      source: string;
      signalSourceKey: string | null;
      boundary: string;
      boundaryAdjustment: BoundaryAdjustmentView | null;
    }>;
  } | null;
  notes?: string;
  /** commissioning only: a past instant the version takes effect from once approved (with backdateReason) */
  effectiveFrom?: string;
  backdateReason?: string;
}
