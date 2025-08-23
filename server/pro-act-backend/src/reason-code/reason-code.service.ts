import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReasonCode } from './reason-code.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class ReasonCodeService {
  constructor(
    @InjectRepository(ReasonCode)
    private readonly reasonCodeRepository: Repository<ReasonCode>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<ReasonCode[]> {
    return this.reasonCodeRepository.find({
      relations: ['parent', 'children', 'tenant'],
    });
  }

  findOne(id: string): Promise<ReasonCode | null> {
    return this.reasonCodeRepository.findOne({
      where: { id },
      relations: ['parent', 'children', 'tenant'],
    });
  }

  async create(data: Partial<ReasonCode>): Promise<ReasonCode> {
    const reasonCode = this.reasonCodeRepository.create(data);
    const saved = await this.reasonCodeRepository.save(reasonCode);
    this.realtimeGateway.broadcastEntityEvent('Created', 'reasonCode', saved);
    return saved;
  }

  async update(id: string, data: Partial<ReasonCode>): Promise<ReasonCode | null> {
    await this.reasonCodeRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'reasonCode', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const reasonCode = await this.findOne(id);
    await this.reasonCodeRepository.delete(id);
    if (reasonCode) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'reasonCode', { id });
    }
  }

  findByTenant(tenantId: string): Promise<ReasonCode[]> {
    return this.reasonCodeRepository.find({
      where: { tenantId },
      relations: ['parent', 'children', 'tenant'],
    });
  }

  findByParent(parentId: string): Promise<ReasonCode[]> {
    return this.reasonCodeRepository.find({
      where: { parentId },
      relations: ['parent', 'children', 'tenant'],
    });
  }

  findRootCodes(tenantId: string): Promise<ReasonCode[]> {
    return this.reasonCodeRepository.find({
      where: { tenantId, parentId: null as any },
      relations: ['parent', 'children', 'tenant'],
    });
  }
} 