import { UserScope } from '../../../auth/scopes/user-scope.entity';

/** Why a grant cannot be revoked here (the screen explains it in words). */
export type ScopeLock =
  | 'home_role'
  | 'own_grant'
  | 'outranks_you'
  | 'other_plant'
  | null;

/** `GET /v2/user-scopes` item: a role a user holds in the plant or in one of its units. */
export interface UserScopeV2View {
  id: string;
  userId: string;
  /** null when the user is not visible to you (a member of another plant) */
  userName: string | null;
  scopeKind: 'tenant' | 'site' | 'unit';
  scopeId: string;
  /** plant, site or unit name; null when unknown */
  scopeName: string | null;
  /** scope role (`viewer`, `reliability_engineer`, ...); screens show its label */
  role: string;
  createdAt: string;
  createdByName: string | null;
  /** null when you may revoke it */
  lock: ScopeLock;
}

export interface ScopeViewContext {
  userNames: ReadonlyMap<string, string>;
  scopeNames: ReadonlyMap<string, string>;
  lockOf: (scope: UserScope) => ScopeLock;
}

export function toUserScopeView(
  scope: UserScope,
  context: ScopeViewContext,
): UserScopeV2View {
  return {
    id: scope.id,
    userId: scope.userId,
    userName: context.userNames.get(scope.userId) ?? null,
    scopeKind: scope.scopeKind,
    scopeId: scope.scopeId,
    scopeName: context.scopeNames.get(scope.scopeId) ?? null,
    role: scope.role,
    createdAt: new Date(scope.createdAt).toISOString(),
    createdByName: scope.createdBy
      ? (context.userNames.get(scope.createdBy) ?? null)
      : null,
    lock: context.lockOf(scope),
  };
}
