import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ProductionPlan } from './production-plan.entity';

@Injectable()
export class ProductionPlanService {
  constructor(
    @InjectRepository(ProductionPlan)
    private readonly planRepository: Repository<ProductionPlan>,
  ) {}

  findAll(): Promise<ProductionPlan[]> {
    return this.planRepository.find();
  }

  findOne(id: string): Promise<ProductionPlan | null> {
    return this.planRepository.findOne({
      where: { id },
    });
  }

  create(data: Partial<ProductionPlan>): Promise<ProductionPlan> {
    const plan = this.planRepository.create({
      ...data,
      id: data.id ?? randomUUID(),
    });
    return this.planRepository.save(plan);
  }

  async update(id: string, data: Partial<ProductionPlan>): Promise<ProductionPlan | null> {
    await this.planRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.planRepository.delete(id);
  }

  findByTenant(tenantId: string): Promise<ProductionPlan[]> {
    return this.planRepository.find({
      where: { tenantId },
    });
  }

  findByStatus(status: string): Promise<ProductionPlan[]> {
    return this.planRepository.find({
      where: { status },
    });
  }
} 