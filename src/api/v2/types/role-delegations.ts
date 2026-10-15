/** SME R1 / R6 (backend `v2/administration/role-delegations`): time-boxed delegations of approval roles. */
export type DelegableRole = 'manager_approver' | 'production_accountant' | 'finance_approver' | 'quality_approver';
export type DelegationScopeKind = 'tenant' | 'site' | 'unit';

export interface RoleDelegationView {
  id: string;
  delegatorId: string;
  delegatorName: string | null;
  delegateId: string;
  delegateName: string | null;
  role: DelegableRole;
  scopeKind: DelegationScopeKind;
  scopeId: string;
  validFrom: string;
  validUntil: string;
  reason: string;
  /** started, not ended and not revoked now (server) */
  inForce: boolean;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
  createdBy: string | null;
  createdAt: string;
  rowVersion: number;
}

/** `POST /role-delegations`: only the declared fields (forbidNonWhitelisted). */
export interface CreateRoleDelegationInput {
  delegatorId: string;
  delegateId: string;
  role: DelegableRole;
  scopeKind: DelegationScopeKind;
  scopeId: string;
  validFrom: string;
  validUntil: string;
  reason: string;
}
