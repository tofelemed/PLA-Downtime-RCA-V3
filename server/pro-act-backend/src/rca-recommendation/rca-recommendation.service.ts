import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RCARecommendation } from './rca-recommendation.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class RCARecommendationService {
  constructor(
    @InjectRepository(RCARecommendation)
    private readonly recommendationRepository: Repository<RCARecommendation>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<RCARecommendation[]> {
    return this.recommendationRepository.find();
  }

  findOne(id: string): Promise<RCARecommendation | null> {
    return this.recommendationRepository.findOneBy({ id });
  }

  async create(data: Partial<RCARecommendation>): Promise<RCARecommendation> {
    const recommendation = this.recommendationRepository.create(data);
    const saved = await this.recommendationRepository.save(recommendation);
    this.realtimeGateway.broadcastEntityEvent('Created', 'rcaRecommendation', saved);
    return saved;
  }

  async update(id: string, data: Partial<RCARecommendation>): Promise<RCARecommendation | null> {
    await this.recommendationRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'rcaRecommendation', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const recommendation = await this.findOne(id);
    await this.recommendationRepository.delete(id);
    if (recommendation) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'rcaRecommendation', { id });
    }
  }
} 