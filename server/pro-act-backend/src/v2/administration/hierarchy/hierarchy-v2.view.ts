import { Organization } from '../../../organization/organization.entity';
import { Tenant } from '../../../tenant/tenant.entity';

/** `GET /v2/organizations` item. */
export interface OrganizationV2View {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  /** whether the caller may add plants to it */
  canAddPlants: boolean;
  /** whether the caller may delete it (super administrators; never while it has plants) */
  canDelete: boolean;
}

/** `GET /v2/tenants` item: a plant of the caller's reach. */
export interface PlantV2View {
  id: string;
  code: string;
  name: string;
  description: string | null;
  organizationId: string;
  organizationName: string | null;
  /** IANA zone of the plant record, null when not set (sites carry their own) */
  timezone: string | null;
  calendarSystem: string;
  digits: string;
  isActive: boolean;
  /** whether the caller may delete it (super administrators) */
  canDelete: boolean;
}

export function toOrganizationView(
  organization: Organization,
  flags: { canAddPlants: boolean; canDelete: boolean },
): OrganizationV2View {
  return {
    id: organization.id,
    code: organization.code,
    name: organization.name,
    description: organization.description ?? null,
    isActive: organization.isActive,
    ...flags,
  };
}

export function toPlantView(
  plant: Tenant,
  organizationName: string | null,
  canDelete: boolean,
): PlantV2View {
  return {
    id: plant.id,
    code: plant.code,
    name: plant.name,
    description: plant.description ?? null,
    organizationId: plant.organizationId,
    organizationName,
    timezone: plant.timezone ?? null,
    calendarSystem: plant.calendarSystem,
    digits: plant.digits,
    isActive: plant.isActive,
    canDelete,
  };
}
