import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OEECode } from './oee-code.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class OEECodeService {
  constructor(
    @InjectRepository(OEECode)
    private readonly oeeCodeRepository: Repository<OEECode>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<OEECode[]> {
    return this.oeeCodeRepository.find();
  }

  findOne(id: string): Promise<OEECode | null> {
    return this.oeeCodeRepository.findOneBy({ id });
  }

  async create(data: Partial<OEECode>): Promise<OEECode> {
    const code = this.oeeCodeRepository.create(data);
    const saved = await this.oeeCodeRepository.save(code);
    this.realtimeGateway.broadcastEntityEvent('Created', 'oeeCode', saved);
    return saved;
  }

  async update(id: string, data: Partial<OEECode>): Promise<OEECode | null> {
    await this.oeeCodeRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'oeeCode', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const code = await this.findOne(id);
    await this.oeeCodeRepository.delete(id);
    if (code) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'oeeCode', { id });
    }
  }
} 