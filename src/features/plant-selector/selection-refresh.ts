import type { DirectoryOrganization, DirectoryPlant } from '@/api/v2/types/plant-directory';
import type { PlantSelection } from '@/contexts/PlantSelectionContext';

/**
 * The stored selection with the plant's and organisation's current names and time zone from the
 * directory (another administrator may have renamed them since it was saved), or null when nothing
 * changed. Units and assets are left as they are.
 */
export function refreshedSelection(
  selection: PlantSelection | null,
  tenants: readonly DirectoryPlant[],
  organizations: readonly DirectoryOrganization[],
): PlantSelection | null {
  if (!selection?.tenant) return null;
  const tenant = tenants.find((entry) => entry.id === selection.tenant?.id);
  const organization = organizations.find((entry) => entry.id === (selection.organization?.id ?? tenant?.organizationId));
  let next = selection;
  if (tenant && (tenant.name !== selection.tenant.name || (tenant.timezone ?? null) !== (selection.tenant.timezone ?? null))) {
    next = { ...next, tenant: { ...selection.tenant, name: tenant.name, timezone: tenant.timezone } };
  }
  if (organization && selection.organization && organization.name !== selection.organization.name) {
    next = { ...next, organization: { ...selection.organization, name: organization.name } };
  }
  return next === selection ? null : next;
}
