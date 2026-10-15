import { EntityManager } from 'typeorm';
import { actingDelegation } from '../auth/delegations/acting-delegation';
import { RequestContext } from '../common/context/request-context';
import { REVISION_APPROVERS } from '../v2/periods/period-roles';

/**
 * SME R1 / R6: `{ asDelegate: { delegationId, delegatorId, role } }` when the caller decides a period of
 * the unit only through a delegation of a revision-approver role, for the workflow step's detail; `{}`
 * otherwise. The approval history then shows on whose behalf the delegate acted.
 */
export async function delegateDetail(
  manager: EntityManager,
  context: RequestContext,
  unitId: string,
): Promise<Record<string, unknown>> {
  const [unit]: Array<{ site_id: string | null }> = await manager.query(
    `SELECT "site_id" FROM "units" WHERE "id" = $1`,
    [unitId],
  );
  const used = actingDelegation(context, REVISION_APPROVERS, {
    id: unitId,
    siteId: unit?.site_id ?? null,
  });
  return used ? { asDelegate: used } : {};
}
