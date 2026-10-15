import { SourceAuthorityPolicy } from '../../domain/actuals/period/period-actuals.types';
import { SourceAuthorityInForce } from './source-authority-v2.service';

/** D05 / SME E7: who configures the authority of a unit's output (integration owner, production accounting). */
export const SOURCE_AUTHORITY_WRITERS = [
  'integration_admin',
  'production_accountant',
] as const;

/** The source authority version in force as the v2 API returns it. */
export interface SourceAuthorityV2View {
  policyId: string;
  version: number;
  unitId: string | null;
  effectiveFrom: string;
  notes: string | null;
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
