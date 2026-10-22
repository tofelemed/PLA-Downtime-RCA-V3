import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { isOrgAdminOf } from '../../../auth/roles/org-access';
import { memberTenantIds } from '../../../auth/roles/grant-policy';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { isValidTimeZone } from '../../../domain/calendar/zone-timeline';
import { Organization } from '../../../organization/organization.entity';
import { OrganizationService } from '../../../organization/organization.service';
import { Tenant } from '../../../tenant/tenant.entity';
import { TenantService } from '../../../tenant/tenant.service';
import { Unit } from '../../../unit/unit.entity';
import { User } from '../../../users/user.entity';
import { listResponse, ListResponse } from '../../common/response';
import { expressionKeysetPage } from '../common/expression-keyset';
import { PlaceNamesService } from '../common/place-names.service';
import {
  CreateOrganizationV2Dto,
  CreatePlantV2Dto,
  HierarchyListQueryDto,
  PlantDisplaySettingsV2Dto,
  PlantsListQueryDto,
} from './hierarchy-v2.dto';
import {
  OrganizationV2View,
  PlantV2View,
  toOrganizationView,
  toPlantView,
} from './hierarchy-v2.view';
import { defaultWeekStart } from '../../../domain/calendar/week-start';
import { outsideTenantBinding } from '../common/outside-tenant-binding';
import { provisionPlant } from './plant-provisioning';

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
const inUse = (code: string, message: string) =>
  new ConflictException({ code, message });

/** Organizations and plants (Admin panel → Plants & organisations; Settings → Plant settings). */
@Injectable()
export class HierarchyV2Service {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(Tenant) private readonly plants: Repository<Tenant>,
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly organizationService: OrganizationService,
    private readonly tenantService: TenantService,
    private readonly places: PlaceNamesService,
  ) {}

  async listOrganizations(
    context: RequestContext,
    query: HierarchyListQueryDto,
  ): Promise<ListResponse<OrganizationV2View>> {
    const qb = this.organizations.createQueryBuilder('o');
    if (!context.isSuperAdmin) {
      const own = context.organizationId ? [context.organizationId] : [];
      const ids = [
        ...own,
        ...(await this.organizationsOf(memberTenantIds(context))),
      ];
      qb.where('o.id IN (:...ids)', { ids: ids.length ? ids : [NONE] });
    }
    const page = await this.byName(qb, 'o', query);
    const items = page.items.map((org) =>
      toOrganizationView(org, {
        canAddPlants: context.isSuperAdmin || isOrgAdminOf(context, org.id),
        canDelete: context.isSuperAdmin,
        canEdit: context.isSuperAdmin || isOrgAdminOf(context, org.id),
      }),
    );
    return listResponse(items, page.nextCursor, {
      tenantId: requireTenantId(context),
    });
  }

  async listPlants(
    context: RequestContext,
    query: PlantsListQueryDto,
  ): Promise<ListResponse<PlantV2View>> {
    const qb = this.visiblePlants(context);
    if (query.organizationId)
      qb.andWhere('p.organizationId = :orgId', { orgId: query.organizationId });
    const page = await this.byName(qb, 'p', query);
    const items = await this.plantViews(context, page.items);
    return listResponse(items, page.nextCursor, {
      tenantId: requireTenantId(context),
    });
  }

  async getPlant(context: RequestContext, id: string): Promise<PlantV2View> {
    const plant = await this.visiblePlants(context)
      .andWhere('p.id = :id', { id })
      .getOne();
    if (!plant) throw notFound();
    const [view] = await this.plantViews(context, [plant]);
    return view;
  }

  async createOrganization(
    context: RequestContext,
    body: CreateOrganizationV2Dto,
  ): Promise<OrganizationV2View> {
    if (await this.organizations.count({ where: { code: body.code } })) {
      throw inUse(
        'CODE_EXISTS',
        'An organization with this code already exists',
      );
    }
    const saved = await this.organizationService.create({
      code: body.code,
      name: body.name.trim(),
      description: body.description,
      isActive: true,
    });
    return toOrganizationView(saved, {
      canAddPlants: true,
      canDelete: context.isSuperAdmin,
      canEdit: true,
    });
  }

  async deleteOrganization(context: RequestContext, id: string): Promise<void> {
    const organization = await this.organizationService.findOneVisible(
      context,
      id,
    );
    if (!organization) throw notFound();
    if (await this.plants.count({ where: { organizationId: id } })) {
      throw inUse('ORGANIZATION_HAS_PLANTS', 'Delete or move its plants first');
    }
    await this.organizationService.remove(id);
  }

  /**
   * Creates a plant with its default site and, for an organization administrator, a plant-wide grant so the
   * creator can switch to it at once (Setup UX audit: otherwise 403 TENANT_NOT_ALLOWED).
   */
  async createPlant(
    context: RequestContext,
    body: CreatePlantV2Dto,
  ): Promise<PlantV2View> {
    await this.assertPlantCreatable(context, body);
    const data = {
      ...body,
      name: body.name.trim(),
      weekStart:
        body.weekStart ?? defaultWeekStart(body.timezone, body.calendarSystem),
      isActive: true,
    };
    // the new plant is outside the caller's tenant binding until its scope exists
    const saved = await outsideTenantBinding(context, () =>
      this.tenantService.create(data, (manager, plant) =>
        provisionPlant(manager, plant, context),
      ),
    );
    return this.getPlant(context, saved.id);
  }

  async deletePlant(context: RequestContext, id: string): Promise<void> {
    const plant = await this.tenantService.findOneVisible(context, id);
    if (!plant) throw notFound();
    if (id === context.tenantId) {
      throw new UnprocessableEntityException({
        code: 'PLANT_IN_USE',
        message: 'Switch to another plant before deleting this one',
      });
    }
    const [unitCount, userCount] = await Promise.all([
      this.units.count({ where: { tenantId: id } }),
      this.users.count({ where: { tenantId: id } }),
    ]);
    if (unitCount || userCount)
      throw inUse('PLANT_IN_USE', 'The plant still has units or users');
    await this.tenantService.remove(id);
  }

  async updateDisplaySettings(
    context: RequestContext,
    id: string,
    body: PlantDisplaySettingsV2Dto,
  ): Promise<PlantV2View> {
    await this.tenantService.updateDisplaySettings(context, id, body);
    return this.getPlant(context, id);
  }

  private async assertPlantCreatable(
    context: RequestContext,
    body: CreatePlantV2Dto,
  ): Promise<void> {
    if (!context.isSuperAdmin && !isOrgAdminOf(context, body.organizationId)) {
      throw new ForbiddenException({
        code: 'ORGANIZATION_NOT_ALLOWED',
        message:
          'Only an administrator of this organization can add plants to it',
      });
    }
    if (!isValidTimeZone(body.timezone)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TIMEZONE',
        message: 'Unknown time zone',
      });
    }
    if (
      !(await this.organizations.count({ where: { id: body.organizationId } }))
    )
      throw notFound();
    if (await this.plants.count({ where: { code: body.code } })) {
      throw inUse('CODE_EXISTS', 'A plant with this code already exists');
    }
  }

  private visiblePlants(context: RequestContext): SelectQueryBuilder<Tenant> {
    const qb = this.plants.createQueryBuilder('p');
    if (context.isSuperAdmin) return qb;
    const members = memberTenantIds(context);
    return qb.where(
      new Brackets((inner) => {
        inner.where('p.id IN (:...members)', {
          members: members.length ? members : [NONE],
        });
        if (context.legacyRole === 'OrgAdmin' && context.organizationId) {
          inner.orWhere('p.organizationId = :ownOrg', {
            ownOrg: context.organizationId,
          });
        }
      }),
    );
  }

  private async plantViews(
    context: RequestContext,
    plants: Tenant[],
  ): Promise<PlantV2View[]> {
    const names = await this.places.organizationNames(
      plants.map((plant) => plant.organizationId),
    );
    return plants.map((plant) =>
      toPlantView(plant, names.get(plant.organizationId) ?? null, {
        canDelete: context.isSuperAdmin,
        canEdit:
          context.isSuperAdmin || isOrgAdminOf(context, plant.organizationId),
      }),
    );
  }

  private async organizationsOf(tenantIds: string[]): Promise<string[]> {
    if (tenantIds.length === 0) return [];
    const rows = await this.plants
      .createQueryBuilder('p')
      .select('DISTINCT p.organizationId', 'organizationId')
      .where('p.id IN (:...tenantIds)', { tenantIds })
      .getRawMany<{ organizationId: string }>();
    return rows.map((row) => row.organizationId);
  }

  private byName<T extends Organization | Tenant>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    query: HierarchyListQueryDto,
  ) {
    return expressionKeysetPage(qb, {
      alias,
      expression: `"${alias}"."name"`,
      cast: 'text',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
      valueOf: (row) => row.name,
    });
  }
}

/** Nil UUID: keeps `IN (...)` valid when the caller has nothing to list. */
const NONE = '00000000-0000-0000-0000-000000000000';
