import { DeclaredEnginePolicy } from '../domain/accounting/declared.types';
import {
  LossAccountingPolicy,
  policyForUnit,
} from '../periods/loss-accounting-policy';

/**
 * The `loss_accounting` fields the accounting engine applies to a unit's period (declared mode, spec §4.4):
 * declared only on the accounting unit, computed on every other unit.
 */
export function declaredPolicyOf(
  policy: LossAccountingPolicy,
  unitId: string,
): Required<DeclaredEnginePolicy> {
  const applied = policyForUnit(policy, unitId);
  return {
    lossBasis: applied.lossBasis,
    targetSource: applied.targetSource,
    stopsCrossCheck: applied.stopsCrossCheck,
    identityTolerance: applied.identityTolerance,
  };
}
