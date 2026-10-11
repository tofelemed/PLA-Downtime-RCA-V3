import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Tenant } from './tenant.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { RequestContext } from '../common/context/request-context';
import { memberTenantIds } from '../auth/roles/grant-policy';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly realtimeGateway: RealtimeGateway,
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
