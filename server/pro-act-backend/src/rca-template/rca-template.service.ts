import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RCATemplate } from './rca-template.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class RCATemplateService {
  constructor(
    @InjectRepository(RCATemplate)
    private readonly templateRepository: Repository<RCATemplate>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<RCATemplate[]> {
    return this.templateRepository.find({
      relations: ['organization', 'tenant'],
    });
  }

  findOne(id: string): Promise<RCATemplate | null> {
    return this.templateRepository.findOne({
      where: { id },
      relations: ['organization', 'tenant'],
    });
  }

  async create(data: Partial<RCATemplate>): Promise<RCATemplate> {
    const template = this.templateRepository.create(data);
    const saved = await this.templateRepository.save(template);
    this.realtimeGateway.broadcastEntityEvent('Created', 'rcaTemplate', saved);
    return saved;
  }

  async update(id: string, data: Partial<RCATemplate>): Promise<RCATemplate | null> {
    await this.templateRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'rcaTemplate', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const template = await this.findOne(id);
    await this.templateRepository.delete(id);
    if (template) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'rcaTemplate', { id });
    }
  }

  findByTenant(tenantId: string): Promise<RCATemplate[]> {
    return this.templateRepository.find({
      where: { tenantId },
      relations: ['organization', 'tenant'],
    });
  }

  findByOrganization(organizationId: string): Promise<RCATemplate[]> {
    return this.templateRepository.find({
      where: { organizationId },
      relations: ['organization', 'tenant'],
    });
  }

  findByCategory(category: string): Promise<RCATemplate[]> {
    return this.templateRepository.find({
      where: { category },
      relations: ['organization', 'tenant'],
    });
  }
} 