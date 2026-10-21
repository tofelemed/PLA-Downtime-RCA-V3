import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { canWriteSetting } from '../app-settings/app-settings-access.policy';
import { UpdateTenantDisplaySettingsDto } from './dto/update-tenant-display-settings.dto';
import { randomUUID } from 'crypto';
import { Tenant } from './tenant.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { RequestContext } from '../common/context/request-context';
import { memberTenantIds } from '../auth/roles/grant-policy';
import { AuditLogService } from '../audit-log/audit-log.service';
import { changedFields } from '../audit-log/settings-change';
import { announcePlantSettings } from '../realtime/settings-notices';

/** Audit labels of the plant display settings. */
const DISPLAY_SETTING_LABELS = {
  calendarSystem: 'calendar',
  digits: 'digits',
  weekStart: 'week start',
};

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find();
  }

  /** Tenants the caller may see: SuperAdmin all, OrgAdmin its organization, others their member tenants. */
  async findVisible(caller: RequestContext): Promise<Tenant[]> {
    const where = visibleTenants(caller);
    if (!where) return this.findAll();
    return where.length ? this.tenantRepository.find({ where }) : [];
  }

  findOne(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findOneBy({ id });
  }

  /** `findOne` restricted to what `findVisible` lists (a foreign tenant is simply not found). */
  async findOneVisible(
    caller: RequestContext,
    id: string,
  ): Promise<Tenant | null> {
    const tenant = await this.findOne(id);
    return tenant && isVisibleTo(caller, tenant) ? tenant : null;
  }

  /** Organization of each listed tenant (id and organization_id only; unknown ids are left out). */
  async organizationsOf(ids: readonly string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const rows = await this.tenantRepository.find({
      where: { id: In([...ids]) },
      select: { id: true, organizationId: true },
    });
    return new Map(rows.map((row) => [row.id, row.organizationId]));
  }

  findByCodeAndOrganization(
    code: string,
    organizationId: string,
  ): Promise<Tenant | null> {
    return this.tenantRepository.findOneBy({ code, organizationId });
  }

  async create(data: Partial<Tenant>): Promise<Tenant> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const tenant = this.tenantRepository.create({
      id,
      ...data,
    });
    const saved = await this.tenantRepository.save(tenant);
    this.realtimeGateway.broadcastEntityEvent('Created', 'tenant', saved);
    return saved;
  }

  async update(id: string, data: Partial<Tenant>): Promise<Tenant | null> {
    await this.tenantRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'tenant', updated);
    }
    return updated;
  }

  /**
   * Calendar, digit display and week start of one tenant. Same rule as a tenant-owned app setting: SuperAdmin,
   * or a TenantAdmin / manager approver acting in that tenant. Only these columns change; the change is
   * audited with its old and new values under the edited plant.
   */
  async updateDisplaySettings(
    caller: RequestContext,
    id: string,
    dto: UpdateTenantDisplaySettingsDto,
  ): Promise<Tenant> {
    const tenant = await this.findOneVisible(caller, id);
    if (!tenant) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    if (!canWriteSetting({ tenantId: tenant.id, userId: null }, caller)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message:
          'Only a plant administrator or a manager approver of this plant can change its display settings',
      });
    }
    const changes: Partial<Tenant> = {};
    if (dto.calendarSystem) changes.calendarSystem = dto.calendarSystem;
    if (dto.digits) changes.digits = dto.digits;
    if (dto.weekStart) changes.weekStart = dto.weekStart;
    if (!Object.keys(changes).length) return tenant;
    await this.tenantRepository.update(tenant.id, changes);
    const updated = (await this.findOne(tenant.id)) ?? {
      ...tenant,
      ...changes,
    };
    await this.auditLog.recordChange(caller, {
      entityType: 'Tenant',
      entityId: tenant.id,
      tenantId: tenant.id,
      organizationId: tenant.organizationId ?? null,
      subject: `Changed plant settings of ${tenant.name}`,
      changes: changedFields(tenant, updated, [
        'calendarSystem',
        'digits',
        'weekStart',
      ]),
      labels: DISPLAY_SETTING_LABELS,
    });
    // every open screen of the plant refetches (week buckets, dates and labels follow these settings)
    await announcePlantSettings(this.tenantRepository.manager, tenant.id);
    this.realtimeGateway.broadcastEntityEvent('Updated', 'tenant', updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantRepository.delete(id);
    if (tenant) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'tenant', { id });
    }
  }
}

function isVisibleTo(caller: RequestContext, tenant: Tenant): boolean {
  return (
    caller.isSuperAdmin ||
    memberTenantIds(caller).includes(tenant.id) ||
    (caller.legacyRole === 'OrgAdmin' &&
      tenant.organizationId === caller.organizationId)
  );
}

/** OR-ed clauses of the caller's visibility; undefined means everything (SuperAdmin). */
function visibleTenants(
  caller: RequestContext,
): FindOptionsWhere<Tenant>[] | undefined {
  if (caller.isSuperAdmin) return undefined;
  const clauses: FindOptionsWhere<Tenant>[] = [];
  const members = memberTenantIds(caller);
  if (members.length) clauses.push({ id: In(members) });
  if (caller.legacyRole === 'OrgAdmin' && caller.organizationId) {
    clauses.push({ organizationId: caller.organizationId });
  }
  return clauses;
}
