import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  assertOrganizationWritable,
  isOrgAdminOf,
} from '../../../auth/roles/org-access';
import {
  anonymousContext,
  RequestContext,
  runWithRequestContext,
} from '../../../common/context/request-context';
import {
  assertRevision,
  staleRevision,
} from '../../../common/concurrency/revision';
import { isValidTimeZone } from '../../../domain/calendar/zone-timeline';
import { Organization } from '../../../organization/organization.entity';
import { OrganizationService } from '../../../organization/organization.service';
import { Tenant } from '../../../tenant/tenant.entity';
import { UpdateOrganizationV2Dto, UpdatePlantV2Dto } from './hierarchy-v2.dto';
import { HierarchyV2Service } from './hierarchy-v2.service';
import {
  OrganizationV2View,
  PlantDetailV2View,
  toOrganizationView,
} from './hierarchy-v2.view';
import {
  isTimezoneLocked,
  plantTimezoneUsage,
  timezoneLocked,
  timezoneLockReason,
} from './plant-timezone-lock';

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });

interface TextChanges {
  name?: string;
  description?: string | null;
}

/** Name / description of a PATCH body: names trimmed, an empty or null description clears it. */
function textChanges(body: UpdateOrganizationV2Dto): TextChanges {
  const changes: TextChanges = {};
  if (body.name !== undefined) changes.name = body.name.trim();
  if (body.description !== undefined) {
    const text = body.description?.trim() ?? '';
    changes.description = text === '' ? null : text;
  }
  return changes;
}

/** Only the fields that differ from the stored row. */
function differing<C extends object>(row: object, changes: C): Partial<C> {
  const stored = row as Record<string, unknown>;
  const entries = Object.entries(changes).filter(
    ([key, value]) => (stored[key] ?? null) !== value,
  );
  return Object.fromEntries(entries) as Partial<C>;
}

interface PlantChanges extends TextChanges {
  timezone?: string;
}

/**
 * Editing organizations and plants (DECISIONS 2026-10-19): name and description for super administrators
 * and the organization's administrator; codes never change; the plant time zone only while nothing was
 * derived in it yet. Every edit is conditional on the row version the caller read (If-Match → 412).
 * The global audit interceptor records each PATCH.
 */
@Injectable()
export class HierarchyEditV2Service {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(Tenant) private readonly plants: Repository<Tenant>,
    private readonly organizationService: OrganizationService,
    private readonly hierarchy: HierarchyV2Service,
  ) {}

  async getOrganization(
    context: RequestContext,
    id: string,
  ): Promise<OrganizationV2View> {
    const organization = await this.organizationService.findOneVisible(
      context,
      id,
    );
    if (!organization) throw notFound();
    const writable = context.isSuperAdmin || isOrgAdminOf(context, id);
    return toOrganizationView(organization, {
      canAddPlants: writable,
      canDelete: context.isSuperAdmin,
      canEdit: writable,
    });
  }

  async updateOrganization(
    context: RequestContext,
    id: string,
    expectedVersion: number,
    body: UpdateOrganizationV2Dto,
  ): Promise<OrganizationV2View> {
    const organization = await this.organizationService.findOneVisible(
      context,
      id,
    );
    if (!organization) throw notFound();
    assertOrganizationWritable(context, id);
    assertRevision(organization.rowVersion, expectedVersion);
    const changes = differing(organization, textChanges(body));
    await conditionalUpdate(
      this.organizations.manager,
      Organization,
      id,
      expectedVersion,
      changes,
    );
    return this.getOrganization(context, id);
  }

  async getPlant(
    context: RequestContext,
    id: string,
  ): Promise<PlantDetailV2View> {
    const view = await this.hierarchy.getPlant(context, id);
    if (!view.canEdit) {
      return { ...view, timezoneEditable: false, timezoneLockedReason: null };
    }
    const usage = await outsideTenantBinding(context, () =>
      plantTimezoneUsage(this.plants.manager, id, 1),
    );
    return {
      ...view,
      timezoneEditable: !isTimezoneLocked(usage),
      timezoneLockedReason: timezoneLockReason(usage),
    };
  }

  async updatePlant(
    context: RequestContext,
    id: string,
    expectedVersion: number,
    body: UpdatePlantV2Dto,
  ): Promise<PlantDetailV2View> {
    // reach first: a plant out of reach is 404, as on GET
    await this.hierarchy.getPlant(context, id);
    const plant = await this.plants.findOne({ where: { id } });
    if (!plant) throw notFound();
    assertOrganizationWritable(context, plant.organizationId);
    assertRevision(plant.rowVersion, expectedVersion);
    const changes: PlantChanges = differing(plant, {
      ...textChanges(body),
      ...timezoneChange(body),
    });
    await outsideTenantBinding(context, () =>
      this.plants.manager.transaction(async (manager) => {
        if (changes.timezone !== undefined) {
          const usage = await plantTimezoneUsage(manager, id);
          if (isTimezoneLocked(usage)) throw timezoneLocked(usage);
        }
        await conditionalUpdate(manager, Tenant, id, expectedVersion, changes);
        await syncDefaultSite(manager, plant, changes);
      }),
    );
    return this.getPlant(context, id);
  }
}

/**
 * Runs `work` on connections without the caller's row-level-security tenant binding. Only after the
 * organization check: an organization administrator administers every plant of its organization but need
 * not hold a scope in it, and the lock counts / default-site sync must see that plant's rows (under the
 * binding they would read 0 and wrongly unlock the time zone).
 */
function outsideTenantBinding<T>(
  context: RequestContext,
  work: () => Promise<T>,
): Promise<T> {
  return runWithRequestContext(anonymousContext(context.correlationId), work);
}

/** The requested time zone, validated (422 INVALID_TIMEZONE). */
function timezoneChange(body: UpdatePlantV2Dto): { timezone?: string } {
  if (body.timezone === undefined) return {};
  const timezone = body.timezone.trim();
  if (!isValidTimeZone(timezone)) {
    throw new UnprocessableEntityException({
      code: 'INVALID_TIMEZONE',
      message: 'Unknown time zone',
    });
  }
  return { timezone };
}

/**
 * `UPDATE … WHERE id AND row_version = expected` (TypeORM adds `row_version + 1` and `updated_at`);
 * nothing matched → 412 STALE_REVISION. No changes → the revision check already done is the answer.
 */
async function conditionalUpdate(
  manager: EntityManager,
  entity: typeof Organization | typeof Tenant,
  id: string,
  expectedVersion: number,
  changes: PlantChanges,
): Promise<void> {
  if (Object.keys(changes).length === 0) return;
  const result = await manager
    .createQueryBuilder()
    .update(entity)
    .set(changes)
    .where('id = :id AND row_version = :expectedVersion', {
      id,
      expectedVersion,
    })
    .execute();
  if (!result.affected) throw staleRevision();
}

/**
 * The plant's default site follows it (today a plant has exactly one, named after it at creation and
 * carrying the zone calendars and displays use): a new time zone replaces the site's (and clears the UTC
 * fallback flag); a rename renames the site while it still carries the old plant name.
 */
async function syncDefaultSite(
  manager: EntityManager,
  plant: Tenant,
  changes: PlantChanges,
): Promise<void> {
  if (changes.timezone !== undefined) {
    await manager.query(
      `UPDATE "sites" SET "timezone" = $2, "timezone_fallback" = false,
              "row_version" = "row_version" + 1, "updated_at" = now()
        WHERE "tenant_id" = $1 AND "is_default"`,
      [plant.id, changes.timezone],
    );
  }
  if (changes.name !== undefined) {
    await manager.query(
      `UPDATE "sites" s SET "name" = $3, "row_version" = s."row_version" + 1, "updated_at" = now()
        WHERE s."tenant_id" = $1 AND s."is_default" AND s."name" = $2
          AND NOT EXISTS (SELECT 1 FROM "sites" o WHERE o."tenant_id" = $1 AND o."name" = $3)`,
      [plant.id, plant.name, changes.name],
    );
  }
}
