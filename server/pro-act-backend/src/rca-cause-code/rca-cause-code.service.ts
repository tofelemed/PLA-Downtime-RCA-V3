import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RCACauseCode } from './rca-cause-code.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class RCACauseCodeService {
  constructor(
    @InjectRepository(RCACauseCode)
    private readonly rcaCauseCodeRepository: Repository<RCACauseCode>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<RCACauseCode[]> {
    return this.rcaCauseCodeRepository.find();
  }

  findOne(id: string): Promise<RCACauseCode | null> {
    return this.rcaCauseCodeRepository.findOneBy({ id });
  }

  async create(data: Partial<RCACauseCode>): Promise<RCACauseCode> {
    const code = this.rcaCauseCodeRepository.create(data);
    const saved = await this.rcaCauseCodeRepository.save(code);
    this.realtimeGateway.broadcastEntityEvent('Created', 'rcaCauseCode', saved);
    return saved;
  }

  async update(id: string, data: Partial<RCACauseCode>): Promise<RCACauseCode | null> {
    await this.rcaCauseCodeRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'rcaCauseCode', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const code = await this.findOne(id);
    await this.rcaCauseCodeRepository.delete(id);
    if (code) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'rcaCauseCode', { id });
    }
  }
} 