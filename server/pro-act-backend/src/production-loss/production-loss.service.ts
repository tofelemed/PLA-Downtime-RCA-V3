import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionLoss } from './production-loss.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class ProductionLossService {
  constructor(
    @InjectRepository(ProductionLoss)
    private readonly lossRepository: Repository<ProductionLoss>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<ProductionLoss[]> {
    return this.lossRepository.find({ relations: ['plan', 'tenant'] });
  }

  findOne(id: string): Promise<ProductionLoss | null> {
    return this.lossRepository.findOne({ where: { id }, relations: ['plan', 'tenant'] });
  }

  async create(data: Partial<ProductionLoss>): Promise<ProductionLoss> {
    const loss = this.lossRepository.create(data);
    const saved = await this.lossRepository.save(loss);
    this.realtimeGateway.broadcastEntityEvent('Created', 'productionLoss', saved);
    return saved;
  }

  async update(id: string, data: Partial<ProductionLoss>): Promise<ProductionLoss | null> {
    await this.lossRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'productionLoss', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const loss = await this.findOne(id);
    await this.lossRepository.delete(id);
    if (loss) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'productionLoss', { id });
    }
  }

  findByPlan(planId: string): Promise<ProductionLoss[]> {
    return this.lossRepository.find({ where: { planId }, relations: ['plan', 'tenant'] });
  }

  findByTenant(tenantId: string): Promise<ProductionLoss[]> {
    return this.lossRepository.find({ where: { tenantId }, relations: ['plan', 'tenant'] });
  }
} 