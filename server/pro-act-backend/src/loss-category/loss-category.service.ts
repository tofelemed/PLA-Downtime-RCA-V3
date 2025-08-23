import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LossCategory } from './loss-category.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class LossCategoryService {
  constructor(
    @InjectRepository(LossCategory)
    private readonly categoryRepository: Repository<LossCategory>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<LossCategory[]> {
    return this.categoryRepository.find({ relations: ['reconcileForm', 'impactCode', 'oeeCode', 'tenant'] });
  }

  findOne(id: string): Promise<LossCategory | null> {
    return this.categoryRepository.findOne({ where: { id }, relations: ['reconcileForm', 'impactCode', 'oeeCode', 'tenant'] });
  }

  async create(data: Partial<LossCategory>): Promise<LossCategory> {
    const category = this.categoryRepository.create(data);
    const saved = await this.categoryRepository.save(category);
    this.realtimeGateway.broadcastEntityEvent('Created', 'lossCategory', saved);
    return saved;
  }

  async update(id: string, data: Partial<LossCategory>): Promise<LossCategory | null> {
    await this.categoryRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'lossCategory', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.delete(id);
    if (category) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'lossCategory', { id });
    }
  }

  findByReconcileForm(reconcileFormId: string): Promise<LossCategory[]> {
    return this.categoryRepository.find({ where: { reconcileFormId }, relations: ['reconcileForm', 'impactCode', 'oeeCode', 'tenant'] });
  }

  findByTenant(tenantId: string): Promise<LossCategory[]> {
    return this.categoryRepository.find({ where: { tenantId }, relations: ['reconcileForm', 'impactCode', 'oeeCode', 'tenant'] });
  }
} 