import { EntityManager } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';

/** A valuation policy version and the default view it opens on. */
export interface ValuationBasisRef {
  /** policy default basis: contribution_margin | standard_cost | economic_impact */
  view: string;
  policyId: string | null;
  policyVersion: number | null;
}

/**
 * Owner, 18 Oct 2026: the valuation view an approved revision shows — the default view frozen in its
 * approval snapshot (approved records are immutable) — next to the current approved policy's default.
 * When they differ the screen notes the pending restatement and offers the current view as a secondary,
 * unapproved toggle; it never substitutes it silently.
 */
export interface ApprovedValuationV2View extends ValuationBasisRef {
  /** the newest approved tenant-wide valuation policy in force (contribution margin, no version, if none) */
  current: ValuationBasisRef;
  /** true when the current policy opens on another view than the one frozen at approval */
  differs: boolean;
  /** the open change proposal of this approved revision (the restatement path), else null */
  restatementProposalId: string | null;
}

interface FrozenRow {
  view: string | null;
  policy_id: string | null;
  policy_version: string | null;
}

interface CurrentRow {
  id: string;
  version: number;
  basis: string | null;
}

const versionOf = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

/** Pure assembly of the view (null when the snapshot froze no valuation: runs before plan 2.6). */
export function approvedValuationViewOf(
  frozen: ValuationBasisRef | null,
  current: ValuationBasisRef,
  openProposalId: string | null,
): ApprovedValuationV2View | null {
  if (!frozen) return null;
  return {
    ...frozen,
    current,
    differs: frozen.view !== current.view,
    restatementProposalId: openProposalId,
  };
}

/** The default view and policy version frozen in the revision's approval snapshot (reviewed valuation). */
async function frozenBasis(
  manager: EntityManager,
  revision: AccountingRevision,
): Promise<ValuationBasisRef | null> {
  const [row] = await manager.query<FrozenRow[]>(
    `SELECT "content"->'reviewed'->'valuation'->>'defaultView' AS "view",
            "content"->'reviewed'->'valuation'->>'policyId' AS "policy_id",
            "content"->'reviewed'->'valuation'->>'policyVersion' AS "policy_version"
       FROM "approval_snapshots" WHERE "revision_id" = $1 AND "tenant_id" = $2`,
    [revision.id, revision.tenantId],
  );
  if (!row?.view) return null;
  return {
    view: row.view,
    policyId: row.policy_id,
    policyVersion: versionOf(row.policy_version),
  };
}

/** SME V8: the newest approved tenant-wide valuation policy in force (same rule as the report default). */
async function currentBasis(
  manager: EntityManager,
  tenantId: string,
): Promise<ValuationBasisRef> {
  const [row] = await manager.query<CurrentRow[]>(
    `SELECT "id", "version", "body"->>'defaultBasis' AS "basis" FROM "accounting_policies"
      WHERE "tenant_id" = $1 AND "policy_kind" = 'valuation_basis' AND "scope_key" = 'tenant'
        AND "approved_at" IS NOT NULL AND "effective_from" <= now()
      ORDER BY "version" DESC LIMIT 1`,
    [tenantId],
  );
  return {
    view: row?.basis ?? 'contribution_margin',
    policyId: row?.id ?? null,
    policyVersion: row?.version ?? null,
  };
}

/** The approved revision's frozen valuation view against the current policy; null for other lifecycles. */
export async function loadApprovedValuation(
  manager: EntityManager,
  revision: AccountingRevision,
  openProposalId: string | null,
): Promise<ApprovedValuationV2View | null> {
  if (revision.lifecycle !== 'approved') return null;
  const frozen = await frozenBasis(manager, revision);
  if (!frozen) return null;
  const current = await currentBasis(manager, revision.tenantId);
  return approvedValuationViewOf(frozen, current, openProposalId);
}
