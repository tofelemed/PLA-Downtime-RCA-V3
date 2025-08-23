import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OEESummary } from './oee-summary.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class OEESummaryService {
  constructor(
    @InjectRepository(OEESummary)
    private readonly summaryRepository: Repository<OEESummary>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<OEESummary[]> {
    return this.summaryRepository.find({ relations: ['plan', 'tenant'] });
  }

  findOne(id: string): Promise<OEESummary | null> {
    return this.summaryRepository.findOne({ where: { id }, relations: ['plan', 'tenant'] });
  }

  async create(data: Partial<OEESummary>): Promise<OEESummary> {
    const summary = this.summaryRepository.create(data);
    const saved = await this.summaryRepository.save(summary);
    this.realtimeGateway.broadcastEntityEvent('Created', 'oeeSummary', saved);
    return saved;
  }

  async update(id: string, data: Partial<OEESummary>): Promise<OEESummary | null> {
    await this.summaryRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'oeeSummary', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const summary = await this.findOne(id);
    await this.summaryRepository.delete(id);
    if (summary) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'oeeSummary', { id });
    }
  }

  findByPlan(planId: string): Promise<OEESummary[]> {
    return this.summaryRepository.find({ where: { planId }, relations: ['plan', 'tenant'] });
  }

  findByTenant(tenantId: string): Promise<OEESummary[]> {
    return this.summaryRepository.find({ where: { tenantId }, relations: ['plan', 'tenant'] });
  }
} 