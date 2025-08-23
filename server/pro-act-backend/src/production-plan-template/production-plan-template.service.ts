import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionPlanTemplate } from './production-plan-template.entity';

@Injectable()
export class ProductionPlanTemplateService {
  constructor(
    @InjectRepository(ProductionPlanTemplate)
    private readonly templateRepository: Repository<ProductionPlanTemplate>,
  ) {}

  findAll(): Promise<ProductionPlanTemplate[]> {
    return this.templateRepository.find({
      relations: ['unit', 'tenant', 'organization'],
    });
  }

  findOne(id: string): Promise<ProductionPlanTemplate | null> {
    return this.templateRepository.findOne({
      where: { id },
      relations: ['unit', 'tenant', 'organization'],
    });
  }

  create(data: Partial<ProductionPlanTemplate>): Promise<ProductionPlanTemplate> {
    const template = this.templateRepository.create(data);
    return this.templateRepository.save(template);
  }

  async update(id: string, data: Partial<ProductionPlanTemplate>): Promise<ProductionPlanTemplate | null> {
    await this.templateRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.templateRepository.delete(id);
  }

  findByTenant(tenantId: string): Promise<ProductionPlanTemplate[]> {
    return this.templateRepository.find({
      where: { tenantId },
      relations: ['unit', 'tenant', 'organization'],
    });
  }
} 