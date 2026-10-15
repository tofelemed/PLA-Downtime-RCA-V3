import { RoleDelegation } from '../../../auth/delegations/role-delegation.entity';
import { delegationInForce } from '../../../auth/delegations/delegation-rules';

export interface RoleDelegationV2View {
  id: string;
  delegatorId: string;
  delegatorName: string | null;
  delegateId: string;
  delegateName: string | null;
  role: string;
  scopeKind: string;
  scopeId: string;
  validFrom: string;
  validUntil: string;
  reason: string;
  /** started, not ended and not revoked now */
  inForce: boolean;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
  createdBy: string | null;
  createdAt: string;
  rowVersion: number;
}

export function toRoleDelegationView(
  d: RoleDelegation,
  names: ReadonlyMap<string, string>,
  now: Date,
): RoleDelegationV2View {
  return {
    id: d.id,
    delegatorId: d.delegatorId,
    delegatorName: names.get(d.delegatorId) ?? null,
    delegateId: d.delegateId,
    delegateName: names.get(d.delegateId) ?? null,
    role: d.role,
    scopeKind: d.scopeKind,
    scopeId: d.scopeId,
    validFrom: d.validFrom.toISOString(),
    validUntil: d.validUntil.toISOString(),
    reason: d.reason,
    inForce: delegationInForce(d, now),
    revokedAt: d.revokedAt ? d.revokedAt.toISOString() : null,
    revokedBy: d.revokedBy,
    revokeReason: d.revokeReason,
    createdBy: d.createdBy ?? null,
    createdAt: d.createdAt.toISOString(),
    rowVersion: d.rowVersion,
  };
}
