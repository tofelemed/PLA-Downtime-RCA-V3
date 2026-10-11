import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { randomUUID } from 'crypto';
import { Organization } from './organization.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { RequestContext } from '../common/context/request-context';
import { memberTenantIds } from '../auth/roles/grant-policy';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<Organization[]> {
    return this.organizationRepository.find();
  }

  /** Organizations the caller may see: SuperAdmin all, others their own and those of their member tenants. */
  findVisible(caller: RequestContext): Promise<Organization[]> {
    if (caller.isSuperAdmin) return this.findAll();
    return this.visibleQuery(caller).getMany();
  }

  findOne(id: string): Promise<Organization | null> {
    return this.organizationRepository.findOneBy({ id });
  }

  /** `findOne` restricted to what `findVisible` lists (a foreign organization is simply not found). */
  findOneVisible(
    caller: RequestContext,
    id: string,
  ): Promise<Organization | null> {
    if (caller.isSuperAdmin) return this.findOne(id);
    return this.visibleQuery(caller).andWhere('org.id = :id', { id }).getOne();
  }

  findByCode(code: string): Promise<Organization | null> {
    return this.organizationRepository.findOneBy({ code });
  }

  async create(data: Partial<Organization>): Promise<Organization> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const org = this.organizationRepository.create({
      id,
      isActive: data.isActive ?? true, // Default to true if not provided
      ...data,
    });
    const saved = await this.organizationRepository.save(org);
    this.realtimeGateway.broadcastEntityEvent('Created', 'organization', saved);
    return saved;
  }

  async update(
    id: string,
    data: Partial<Organization>,
  ): Promise<Organization | null> {
    await this.organizationRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent(
        'Updated',
        'organization',
        updated,
      );
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const org = await this.findOne(id);
    await this.organizationRepository.delete(id);
    if (org) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'organization', org);
    }
  }

  /** The caller's own organization plus the organizations of the tenants it is a member of. */
  private visibleQuery(
    caller: RequestContext,
  ): SelectQueryBuilder<Organization> {
    const tenantIds = memberTenantIds(caller);
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    if (caller.organizationId) {
      clauses.push('org.id = :own');
      params.own = caller.organizationId;
    }
    if (tenantIds.length) {
      clauses.push(
        'org.id IN (SELECT organization_id FROM tenants WHERE id IN (:...tenantIds))',
      );
      params.tenantIds = tenantIds;
    }
    return this.organizationRepository
      .createQueryBuilder('org')
      .where(clauses.length ? `(${clauses.join(' OR ')})` : '1 = 0', params);
  }
}
