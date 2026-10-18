import { SourceAuthorityPolicy } from '../../domain/actuals/period/period-actuals.types';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { parseSourceAuthority } from '../../periods/policy-bodies';
import { SourceAuthorityInForce } from './source-authority-v2.service';

/** The source authority version in force as the v2 API returns it. */
export interface SourceAuthorityV2View {
  policyId: string;
  version: number;
  unitId: string | null;
  effectiveFrom: string;
  notes: string | null;
  policy: SourceAuthorityPolicy;
}

export const SOURCE_AUTHORITY_VERSION_STATES = [
  'proposed',
  'approved',
  'rejected',
] as const;
export type SourceAuthorityVersionState =
  (typeof SOURCE_AUTHORITY_VERSION_STATES)[number];

/** One source authority version (draft, approved or rejected) as the v2 API returns it. */
export interface SourceAuthorityVersionV2View {
  id: string;
  version: number;
  /** null = tenant-wide */
  unitId: string | null;
  state: SourceAuthorityVersionState;
  /** approved and in force now for its scope */
  inForce: boolean;
  /** a draft's is its creation; approval moves it to the approval instant (or the requested backdate) */
  effectiveFrom: string;
  effectiveTo: string | null;
  /** the version in force the draft was prepared from */
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
  policy: SourceAuthorityPolicy;
}

export function toSourceAuthorityView(
  found: SourceAuthorityInForce,
): SourceAuthorityV2View {
  return {
    policyId: found.row.id,
    version: found.row.version,
    unitId: found.row.unitId,
    effectiveFrom: new Date(found.row.effectiveFrom).toISOString(),
    notes: found.row.notes,
    policy: found.body,
  };
}

export function versionStateOf(
  row: AccountingPolicy,
): SourceAuthorityVersionState {
  if (row.approvedAt) return 'approved';
  return row.rejectedAt ? 'rejected' : 'proposed';
}

const iso = (value: Date | null): string | null =>
  value ? new Date(value).toISOString() : null;

export function toSourceAuthorityVersionView(
  row: AccountingPolicy,
  now: Date = new Date(),
): SourceAuthorityVersionV2View {
  const state = versionStateOf(row);
  const from = new Date(row.effectiveFrom);
  const to = row.effectiveTo ? new Date(row.effectiveTo) : null;
  return {
    id: row.id,
    version: row.version,
    unitId: row.unitId,
    state,
    inForce: state === 'approved' && from <= now && (!to || to > now),
    effectiveFrom: from.toISOString(),
    effectiveTo: iso(to),
    basedOnId: row.basedOnId,
    createdBy: row.createdBy,
    createdAt: new Date(row.createdAt).toISOString(),
    approvedBy: row.approvedBy,
    approvedAt: iso(row.approvedAt),
    rejectedBy: row.rejectedBy,
    rejectedAt: iso(row.rejectedAt),
    rejectionReason: row.rejectionReason,
    notes: row.notes,
    requestedEffectiveFrom: iso(row.requestedEffectiveFrom),
    backdateReason: row.backdateReason,
    policy: parseSourceAuthority(row.body),
  };
}
