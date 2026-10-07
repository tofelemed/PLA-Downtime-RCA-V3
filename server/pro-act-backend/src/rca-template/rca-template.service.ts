import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
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
    // Note: organization and tenant relations don't exist in database schema
    return this.templateRepository.find({
      // relations: ['organization', 'tenant'],
    });
  }

  findOne(id: string): Promise<RCATemplate | null> {
    // Note: organization and tenant relations don't exist in database schema
    return this.templateRepository.findOne({
      where: { id },
      // relations: ['organization', 'tenant'],
    });
  }

  async create(data: Partial<RCATemplate>): Promise<RCATemplate> {
    // Note: verificationChecklist doesn't exist in database schema, but logicTreeStructure maps to template_data
    const id = randomUUID();
    const template = this.templateRepository.create({
      id,
      ...data,
      logicTreeStructure: data.logicTreeStructure ?? null,
      // verificationChecklist: data.verificationChecklist ?? [],
    });
    const saved = await this.templateRepository.save(template);
    this.realtimeGateway.broadcastEntityEvent('Created', 'rcaTemplate', saved);
    return saved;
  }

  async update(id: string, data: Partial<RCATemplate>): Promise<RCATemplate | null> {
    // Note: verificationChecklist doesn't exist in database schema, but logicTreeStructure maps to template_data
    const updatePayload: Partial<RCATemplate> = {
      ...data,
      ...(data.logicTreeStructure !== undefined && { logicTreeStructure: data.logicTreeStructure ?? null }),
      // ...(data.verificationChecklist !== undefined && { verificationChecklist: data.verificationChecklist ?? [] }),
    };
    await this.templateRepository.update(id, updatePayload);
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
    // Note: organization and tenant relations don't exist in database schema
    return this.templateRepository.find({
      where: { tenantId },
      // relations: ['organization', 'tenant'],
    });
  }

  findByOrganization(organizationId: string): Promise<RCATemplate[]> {
    // Note: organization and tenant relations don't exist in database schema
    return this.templateRepository.find({
      where: { organizationId },
      // relations: ['organization', 'tenant'],
    });
  }

  findByCategory(category: string): Promise<RCATemplate[]> {
    // Note: organization and tenant relations don't exist in database schema
    return this.templateRepository.find({
      where: { category },
      // relations: ['organization', 'tenant'],
    });
  }
} 