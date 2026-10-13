import type { AuthenticatedUser } from '../services/api/authApi';
import type { DirectoryPlant as Tenant } from '@/api/v2/types/plant-directory';
import { createLogger } from '../lib/logger';
import { homeTenantOf, maySelectTenant, organizationOf } from '../features/auth/effective-roles';
import type { PlantSelection } from './PlantSelectionContext';

const log = createLogger('plant-selection');
const KEY_PREFIX = 'proact.plantSelection.';

/**
 * The plant selection is a per-user view preference, so it lives in this browser under the user's id.
 * It used to be one server-wide app setting shared by every user and tenant, which made users of
 * other tenants start out acting as whichever plant someone last picked (403 TENANT_NOT_ALLOWED).
 */
export function loadPlantSelection(user: AuthenticatedUser): PlantSelection | null {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + user.id);
    const saved = raw ? (JSON.parse(raw) as PlantSelection) : null;
    if (saved && !isSelectionAllowed(saved, user)) {
      log.warn('Ignoring saved plant selection the user may not act on; falling back to the default plant', {
        tenantId: saved.tenant?.id,
      });
      return null;
    }
    return saved;
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

/**
 * A user may act on their home tenant and on every tenant they hold a scope in (what the server's
 * `maySelectTenant` accepts); SuperAdmin on any plant, OrgAdmin on the plants of its organisation.
 */
export function isSelectionAllowed(selection: PlantSelection, user: AuthenticatedUser): boolean {
  const tenant = selection.tenant;
  if (!tenant?.id) return true;
  return maySelectTenant(user, tenant);
}

/** Default plant: the user's home tenant; otherwise the first plant listed that the user may select. */
export function defaultTenantFor(user: AuthenticatedUser, tenants: readonly Tenant[]): Tenant | null {
  const home = homeTenantOf(user);
  const own = tenants.find((tenant) => tenant.id === home);
  return own ?? selectableTenants(user, tenants)[0] ?? null;
}

/**
 * The plants the selector offers: every plant for SuperAdmin, the plants of its organisation for OrgAdmin
 * (the organisation of the home tenant when the session carries none), otherwise the user's scoped plants.
 */
export function selectableTenants(user: AuthenticatedUser, tenants: readonly Tenant[]): Tenant[] {
  const organizationId = organizationOf(user, tenants);
  return tenants.filter((tenant) => maySelectTenant(user, tenant, organizationId));
}
