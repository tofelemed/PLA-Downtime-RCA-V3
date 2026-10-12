import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ImpactCode } from './impact-code.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { findOrThrow } from '../common/helpers/find-or-throw';

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
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const code = this.impactCodeRepository.create({ id, ...data });
    const saved = await this.impactCodeRepository.save(code);
    this.realtimeGateway.broadcastEntityEvent('Created', 'impactCode', saved);
    return saved;
  }

  async update(id: string, data: Partial<ImpactCode>): Promise<ImpactCode | null> {
    await findOrThrow(this.findOne(id), 'ImpactCode', id);
    await this.impactCodeRepository.update(id, data);
    const updated = await findOrThrow(this.findOne(id), 'ImpactCode', id);
    this.realtimeGateway.broadcastEntityEvent('Updated', 'impactCode', updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await findOrThrow(this.findOne(id), 'ImpactCode', id);
    await this.impactCodeRepository.delete(id);
    this.realtimeGateway.broadcastEntityEvent('Deleted', 'impactCode', { id });
  }
} 