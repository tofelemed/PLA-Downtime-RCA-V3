import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ProductionPlanTemplate } from './production-plan-template.entity';
import { findOrThrow } from '../common/helpers/find-or-throw';

@Injectable()
export class ProductionPlanTemplateService {
  constructor(
    @InjectRepository(ProductionPlanTemplate)
    private readonly templateRepository: Repository<ProductionPlanTemplate>,
  ) {}

  findAll(): Promise<ProductionPlanTemplate[]> {
    // Note: unit, tenant, organization relations don't exist in database schema
    return this.templateRepository.find({
      // relations: ['unit', 'tenant', 'organization'],
    });
  }

  findOne(id: string): Promise<ProductionPlanTemplate | null> {
    // Note: unit, tenant, organization relations don't exist in database schema
    return this.templateRepository.findOne({
      where: { id },
      // relations: ['unit', 'tenant', 'organization'],
    });
  }

  create(data: Partial<ProductionPlanTemplate>): Promise<ProductionPlanTemplate> {
    const id = randomUUID();
    const template = this.templateRepository.create({ id, ...data });
    return this.templateRepository.save(template);
  }

  async update(id: string, data: Partial<ProductionPlanTemplate>): Promise<ProductionPlanTemplate> {
    await findOrThrow(this.findOne(id), 'ProductionPlanTemplate', id);
    await this.templateRepository.update(id, data);
    return findOrThrow(this.findOne(id), 'ProductionPlanTemplate', id);
  }

  async remove(id: string): Promise<void> {
    await findOrThrow(this.findOne(id), 'ProductionPlanTemplate', id);
    await this.templateRepository.delete(id);
  }

  findByTenant(tenantId: string): Promise<ProductionPlanTemplate[]> {
    // Note: unit, tenant, organization relations don't exist in database schema
    return this.templateRepository.find({
      where: { tenantId },
      // relations: ['unit', 'tenant', 'organization'],
    });
  }
} 