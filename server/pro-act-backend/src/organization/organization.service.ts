import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity';
import { RealtimeGateway } from '../realtime.gateway';

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

  findOne(id: string): Promise<Organization | null> {
    return this.organizationRepository.findOneBy({ id });
  }

  async create(data: Partial<Organization>): Promise<Organization> {
    const org = this.organizationRepository.create(data);
    const saved = await this.organizationRepository.save(org);
    this.realtimeGateway.broadcastEntityEvent('Created', 'organization', saved);
    return saved;
  }

  async update(id: string, data: Partial<Organization>): Promise<Organization | null> {
    await this.organizationRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'organization', updated);
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
} 