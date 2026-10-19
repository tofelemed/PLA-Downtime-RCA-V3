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
  /** whether the caller may edit its name and description (super administrators; its organization administrator) */
  canEdit: boolean;
  /** optimistic concurrency revision: send it back as `If-Match` on `PATCH` (also the `ETag`) */
  rowVersion: number;
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
  /** first day of the reporting week: monday (ISO) or saturday (Iranian plants) */
  weekStart: string;
  isActive: boolean;
  /** whether the caller may delete it (super administrators) */
  canDelete: boolean;
  /** whether the caller may edit name, description and time zone (super administrators; its organization administrator) */
  canEdit: boolean;
  /** optimistic concurrency revision: send it back as `If-Match` on `PATCH` (also the `ETag`) */
  rowVersion: number;
}

/** `GET /v2/tenants/{id}` and `PATCH` responses: whether the time zone may still change, and why not. */
export interface PlantDetailV2View extends PlantV2View {
  /** false once the plant has production events, signal samples or calculated periods */
  timezoneEditable: boolean;
  /** plain-language reason when `timezoneEditable` is false, else null */
  timezoneLockedReason: string | null;
}

export interface HierarchyFlags {
  canDelete: boolean;
  canEdit: boolean;
}

export function toOrganizationView(
  organization: Organization,
  flags: HierarchyFlags & { canAddPlants: boolean },
): OrganizationV2View {
  return {
    id: organization.id,
    code: organization.code,
    name: organization.name,
    description: organization.description ?? null,
    isActive: organization.isActive,
    rowVersion: organization.rowVersion,
    ...flags,
  };
}

export function toPlantView(
  plant: Tenant,
  organizationName: string | null,
  flags: HierarchyFlags,
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
    weekStart: plant.weekStart,
    isActive: plant.isActive,
    rowVersion: plant.rowVersion,
    ...flags,
  };
}
