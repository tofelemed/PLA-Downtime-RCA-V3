import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionPlan } from './production-plan.entity';

@Injectable()
export class ProductionPlanService {
  constructor(
    @InjectRepository(ProductionPlan)
    private readonly planRepository: Repository<ProductionPlan>,
  ) {}

  findAll(): Promise<ProductionPlan[]> {
    return this.planRepository.find({
      relations: ['unit', 'product', 'tenant'],
    });
  }

  findOne(id: string): Promise<ProductionPlan | null> {
    return this.planRepository.findOne({
      where: { id },
      relations: ['unit', 'product', 'tenant'],
    });
  }

  create(data: Partial<ProductionPlan>): Promise<ProductionPlan> {
    const plan = this.planRepository.create(data);
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
      relations: ['unit', 'product', 'tenant'],
    });
  }

  findByStatus(status: string): Promise<ProductionPlan[]> {
    return this.planRepository.find({
      where: { status },
      relations: ['unit', 'product', 'tenant'],
    });
  }

  findByApprovalStatus(approvalStatus: string): Promise<ProductionPlan[]> {
    return this.planRepository.find({
      where: { approvalStatus },
      relations: ['unit', 'product', 'tenant'],
    });
  }
} 