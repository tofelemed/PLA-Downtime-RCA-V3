import type { AuthenticatedUser } from '../services/api/authApi';
import type { Tenant } from '../services/MasterDataService';
import { createLogger } from '../lib/logger';
import type { PlantSelection } from './PlantSelectionContext';

const log = createLogger('plant-selection');
const KEY_PREFIX = 'proact.plantSelection.';
const GLOBAL_ROLES: ReadonlySet<string> = new Set(['SuperAdmin', 'OrgAdmin']);

/**
 * The plant selection is a per-user view preference, so it lives in this browser under the user's id.
 * It used to be one server-wide app setting shared by every user and tenant, which made users of
 * other tenants start out acting as whichever plant someone last picked (403 TENANT_NOT_ALLOWED).
 */
export function loadPlantSelection(user: AuthenticatedUser): PlantSelection | null {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + user.id);
    const saved = raw ? (JSON.parse(raw) as PlantSelection) : null;
    return saved && isSelectionAllowed(saved, user) ? saved : null;
  } catch (error: unknown) {
    log.warn('Ignoring unreadable saved plant selection', error);
    return null;
  }
}

export function savePlantSelection(user: AuthenticatedUser, selection: PlantSelection | null): void {
  try {
    if (selection) window.localStorage.setItem(KEY_PREFIX + user.id, JSON.stringify(selection));
    else window.localStorage.removeItem(KEY_PREFIX + user.id);
  } catch (error: unknown) {
    log.warn('Could not save plant selection', error);
  }
}

/** A tenant-bound user may only act on their own tenant; global admins may pick any plant. */
export function isSelectionAllowed(selection: PlantSelection, user: AuthenticatedUser): boolean {
  const tenantId = selection.tenant?.id;
  if (!tenantId || GLOBAL_ROLES.has(user.role)) return true;
  return tenantId === user.tenantId;
}

/** Default plant: the user's own tenant; global admins without one get the first plant listed. */
export function defaultTenantFor(user: AuthenticatedUser, tenants: readonly Tenant[]): Tenant | null {
  const own = tenants.find((tenant) => tenant.id === user.tenantId);
  if (own) return own;
  return GLOBAL_ROLES.has(user.role) ? tenants[0] ?? null : null;
}
