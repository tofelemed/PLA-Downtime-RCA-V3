import { EntityManager } from 'typeorm';
import { parseRcaPolicy, RcaPolicy } from '../domain/rca/rca-policy';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { RCA } from '../rca/rca.entity';

/**
 * The `rca_policy` in force for a case at an instant: its unit's version, else the tenant-wide one (a case
 * without unit reads the tenant-wide version). Workflow rules (gates, FMEA, effectiveness) come from here.
 */
export async function casePolicy(
  manager: EntityManager,
  policies: AccountingPoliciesService,
  rca: Pick<RCA, 'tenantId' | 'unitId'>,
  at: Date,
): Promise<RcaPolicy> {
  return (await casePolicyVersion(manager, policies, rca, at)).policy;
}

/** `casePolicy` with the version number it came from (frozen with an action's criteria, QA L11). */
export async function casePolicyVersion(
  manager: EntityManager,
  policies: AccountingPoliciesService,
  rca: Pick<RCA, 'tenantId' | 'unitId'>,
  at: Date,
): Promise<{ policy: RcaPolicy; version: number }> {
  const found = await policies.rcaPolicyInForce(
    manager,
    { tenantId: rca.tenantId ?? '', unitId: rca.unitId ?? null },
    at,
  );
  return { policy: parseRcaPolicy(found.body), version: found.version };
}
