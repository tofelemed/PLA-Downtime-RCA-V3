import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Tenant } from './tenant.entity';
import { RealtimeGateway } from '../realtime.gateway';

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

  findOne(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findOneBy({ id });
  }

  findByCodeAndOrganization(code: string, organizationId: string): Promise<Tenant | null> {
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