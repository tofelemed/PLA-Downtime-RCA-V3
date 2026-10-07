import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { VerificationStatusCode } from './verification-status-code.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class VerificationStatusCodeService {
  constructor(
    @InjectRepository(VerificationStatusCode)
    private readonly verificationStatusCodeRepository: Repository<VerificationStatusCode>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<VerificationStatusCode[]> {
    return this.verificationStatusCodeRepository.find();
  }

  findOne(id: string): Promise<VerificationStatusCode | null> {
    return this.verificationStatusCodeRepository.findOneBy({ id });
  }

  async create(data: Partial<VerificationStatusCode>): Promise<VerificationStatusCode> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const code = this.verificationStatusCodeRepository.create({ id, ...data });
    const saved = await this.verificationStatusCodeRepository.save(code);
    this.realtimeGateway.broadcastEntityEvent('Created', 'verificationStatusCode', saved);
    return saved;
  }

  async update(id: string, data: Partial<VerificationStatusCode>): Promise<VerificationStatusCode | null> {
    await this.verificationStatusCodeRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'verificationStatusCode', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const code = await this.findOne(id);
    await this.verificationStatusCodeRepository.delete(id);
    if (code) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'verificationStatusCode', { id });
    }
  }
} 