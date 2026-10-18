import { satisfiesRole } from '../auth/roles/role-model';
import { RequestContext } from '../common/context/request-context';

/** Who owns a setting: both null = application-wide. */
export interface SettingOwner {
  tenantId: string | null;
  userId: string | null;
}

const UUID =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
/** Per-user Event Hub tab visibility (`TabVisibilityService`): `tabVisibility.<tenantId>.<userId>`. */
const USER_KEY = new RegExp(`^tabVisibility\\.(${UUID})\\.(${UUID})$`);

/** Owner a new key gets: per-user keys from their name, everything else application-wide. */
export function ownerForKey(key: string): SettingOwner {
  const match = USER_KEY.exec(key);
  if (!match) return { tenantId: null, userId: null };
  return { tenantId: match[1].toLowerCase(), userId: match[2].toLowerCase() };
}

function isGlobalAdmin(context: RequestContext): boolean {
  return context.isSuperAdmin;
}

function isMemberOf(context: RequestContext, tenantId: string): boolean {
  return (
    context.isSuperAdmin ||
    context.tenantId === tenantId ||
    context.scopes.some((scope) => scope.tenantId === tenantId)
  );
}

/**
 * Plan 3.11: application-wide settings are readable by every signed-in user; tenant settings by the
 * tenant's members; per-user settings by their user or SuperAdmin.
 */
export function canReadSetting(
  owner: SettingOwner,
  context: RequestContext,
): boolean {
  if (context.isSuperAdmin) return true;
  if (owner.userId) return context.userId === owner.userId;
  if (owner.tenantId) return isMemberOf(context, owner.tenantId);
  return context.userId !== null;
}

/**
 * Application-wide settings (branding, ...) change only by a SuperAdmin; tenant settings by that
 * tenant's administrators (acting in it); per-user settings by their user in that tenant or SuperAdmin.
 */
export function canWriteSetting(
  owner: SettingOwner,
  context: RequestContext,
): boolean {
  if (context.isSuperAdmin) return true;
  if (owner.userId) {
    return (
      context.userId === owner.userId &&
      isMemberOf(context, owner.tenantId ?? '')
    );
  }
  if (owner.tenantId) {
    return (
      isGlobalAdmin(context) ||
      (context.tenantId === owner.tenantId &&
        (satisfiesRole(context.roles, 'TenantAdmin') ||
          satisfiesRole(context.roles, 'manager_approver')))
    );
  }
  return isGlobalAdmin(context);
}
