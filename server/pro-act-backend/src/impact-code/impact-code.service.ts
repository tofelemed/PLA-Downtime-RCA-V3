import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImpactCode } from './impact-code.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class ImpactCodeService {
  constructor(
    @InjectRepository(ImpactCode)
    private readonly impactCodeRepository: Repository<ImpactCode>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<ImpactCode[]> {
    return this.impactCodeRepository.find();
  }

  findOne(id: string): Promise<ImpactCode | null> {
    return this.impactCodeRepository.findOneBy({ id });
  }

  async create(data: Partial<ImpactCode>): Promise<ImpactCode> {
    const code = this.impactCodeRepository.create(data);
    const saved = await this.impactCodeRepository.save(code);
    this.realtimeGateway.broadcastEntityEvent('Created', 'impactCode', saved);
    return saved;
  }

  async update(id: string, data: Partial<ImpactCode>): Promise<ImpactCode | null> {
    await this.impactCodeRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'impactCode', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const code = await this.findOne(id);
    await this.impactCodeRepository.delete(id);
    if (code) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'impactCode', { id });
    }
  }
} 