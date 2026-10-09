import { EntityManager, In } from 'typeorm';
import { PeriodProductSlice } from '../periods/entities/period-product-slice.entity';
import { ApprovalSnapshot } from './entities/approval-snapshot.entity';
import { RevisionState } from './revision-state';
import { canon } from './reviewed-content';
import { publishWorkflowEvent, WORKFLOW_EVENTS } from './workflow-recorder';

/** D08: no valuation before plan 2.6; the currency policy still carries the placeholder `XXX`. */
export const UNVALUED = {
  status: 'unvalued',
  currency: null,
  reason:
    'valuation pending: plan 2.6 not implemented and the valuation_basis currency is the placeholder XXX (D08)',
} as const;

async function productsOf(
  manager: EntityManager,
  sliceIds: readonly string[],
): Promise<Map<string, string>> {
  if (sliceIds.length === 0) return new Map();
  const slices = await manager.find(PeriodProductSlice, {
    select: { id: true, productId: true },
    where: { id: In([...sliceIds]) },
  });
  return new Map(slices.map((s) => [s.id, s.productId]));
}

function productTotals(state: RevisionState, products: Map<string, string>) {
  return state.reconciliation.slices.map((slice) => ({
    sliceId: slice.sliceId,
    productId: products.get(slice.sliceId) ?? null,
    uom: slice.uom,
    target: canon(slice.target),
    actual: canon(slice.actual),
    gap: canon(slice.gap),
    attributed: canon(slice.attributed) ?? '0',
    toleranceAdjustment: canon(slice.toleranceAdjustment) ?? '0',
    residual: canon(slice.residual),
    overAccounted: canon(slice.overAccounted),
    overproduction: canon(slice.overproduction),
  }));
}

/** The §15.4 content of `PeriodApproved` / `PeriodRestated` (besides the envelope and revision ids). */
function approvalPayload(
  state: RevisionState,
  snapshot: ApprovalSnapshot,
  approver: string,
  products: Map<string, string>,
): Record<string, unknown> {
  const { period, revision, run } = state;
  return {
    unitId: period.unitId,
    utcStart: period.utcStart.toISOString(),
    utcEnd: period.utcEnd.toISOString(),
    priorRevisionId: revision.supersedesId,
    snapshotId: snapshot.id,
    snapshotHash: snapshot.contentHash,
    submittedHash: revision.submittedHash,
    calculationRunId: run?.id ?? null,
    approvedBy: approver,
    policyVersions: (run?.policyVersions ?? []).map((p) => ({
      id: p.id,
      kind: p.kind,
      version: p.version,
    })),
    products: productTotals(state, products),
    quality: state.actuals.map((a) => ({
      sliceId: a.sliceId,
      qualityState: a.qualityState,
      coverageRatio: canon(a.coverageRatio),
    })),
    valuation: UNVALUED,
  };
}

/**
 * `PeriodApproved` (and `PeriodRestated` when the revision supersedes a published one) with the §15.4
 * content: approved per-product totals with their unit of measure, actuals quality, policy versions, the
 * snapshot and its hash, the prior revision, and an explicit unvalued valuation (D08). Written in the
 * approval transaction, so delivery happens after commit and can never undo the approval (WF03).
 */
export async function publishApproval(
  manager: EntityManager,
  state: RevisionState,
  snapshot: ApprovalSnapshot,
  approver: string,
): Promise<void> {
  const products = await productsOf(
    manager,
    state.reconciliation.slices.map((s) => s.sliceId),
  );
  const payload = approvalPayload(state, snapshot, approver, products);
  const { revision } = state;
  await publishWorkflowEvent(
    manager,
    revision,
    WORKFLOW_EVENTS.approved,
    payload,
  );
  if (revision.supersedesId) {
    await publishWorkflowEvent(
      manager,
      revision,
      WORKFLOW_EVENTS.restated,
      payload,
    );
  }
}
