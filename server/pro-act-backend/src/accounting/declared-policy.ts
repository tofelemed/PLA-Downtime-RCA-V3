import { DeclaredEnginePolicy } from '../domain/accounting/declared.types';
import { LossAccountingPolicy } from '../periods/loss-accounting-policy';

/** The `loss_accounting` fields the accounting engine applies (declared mode, spec §4.4). */
export function declaredPolicyOf(
  policy: LossAccountingPolicy,
): Required<DeclaredEnginePolicy> {
  return {
    lossBasis: policy.lossBasis,
    targetSource: policy.targetSource,
    stopsCrossCheck: policy.stopsCrossCheck,
    identityTolerance: policy.identityTolerance,
  };
}
