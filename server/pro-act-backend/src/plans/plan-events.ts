import { EntityManager } from 'typeorm';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import { PlanVersion } from './entities/plan-version.entity';

/** Message type: a plan version became the approved baseline of its plan (PLAN04). */
export const PLAN_VERSION_APPROVED = 'PlanVersionApproved';

/**
 * Outbox message (FND02, committed with the approval) for a newly approved plan version. It names the
 * superseded version and the interval, so the restatement step of 2.4/2.8 can find approved production
 * periods that used the old version and open `period_change_proposals` instead of silently rebaselining;
 * the superseded version's periods stay frozen as they were.
 */
export async function recordPlanApproved(
  manager: EntityManager,
  approved: PlanVersion,
  superseded: PlanVersion | null,
  isAccountingBaseline: boolean,
): Promise<void> {
  await enqueueOutbox(manager, [
    {
      tenantId: approved.tenantId,
      aggregateType: 'production_plan',
      aggregateId: approved.planId,
      type: PLAN_VERSION_APPROVED,
      version: approved.version,
      payload: {
        planId: approved.planId,
        planVersionId: approved.id,
        version: approved.version,
        scenarioId: approved.scenarioId,
        isAccountingBaseline,
        unitId: approved.unitId,
        validFrom: approved.validFrom.toISOString(),
        validTo: approved.validTo.toISOString(),
        supersededVersionId: superseded?.id ?? null,
        supersededVersion: superseded?.version ?? null,
        restatementRequired: superseded !== null,
        reason: approved.changeReason,
      },
    },
  ]);
}
