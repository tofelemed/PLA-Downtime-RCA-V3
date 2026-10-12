import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ReasonCode } from './reason-code.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { findOrThrow } from '../common/helpers/find-or-throw';

@Injectable()
export class ReasonCodeService {
  constructor(
    @InjectRepository(ReasonCode)
    private readonly reasonCodeRepository: Repository<ReasonCode>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<ReasonCode[]> {
    // Note: parent and children relations don't exist in database schema
    return this.reasonCodeRepository.find({
      // relations: ['parent', 'children', 'tenant'],
    });
  }

  findOne(id: string): Promise<ReasonCode | null> {
    // Note: parent and children relations don't exist in database schema
    return this.reasonCodeRepository.findOne({
      where: { id },
      // relations: ['parent', 'children', 'tenant'],
    });
  }

  async create(data: Partial<ReasonCode>): Promise<ReasonCode> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const reasonCode = this.reasonCodeRepository.create({ id, ...data });
    const saved = await this.reasonCodeRepository.save(reasonCode);
    this.realtimeGateway.broadcastEntityEvent('Created', 'reasonCode', saved);
    return saved;
  }

  async update(id: string, data: Partial<ReasonCode>): Promise<ReasonCode | null> {
    await findOrThrow(this.findOne(id), 'ReasonCode', id);
    await this.reasonCodeRepository.update(id, data);
    const updated = await findOrThrow(this.findOne(id), 'ReasonCode', id);
    this.realtimeGateway.broadcastEntityEvent('Updated', 'reasonCode', updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await findOrThrow(this.findOne(id), 'ReasonCode', id);
    await this.reasonCodeRepository.delete(id);
    this.realtimeGateway.broadcastEntityEvent('Deleted', 'reasonCode', { id });
  }

  findByTenant(tenantId: string): Promise<ReasonCode[]> {
    // Note: parent, children, and tenant relations don't exist in database schema
    return this.reasonCodeRepository.find({
      where: { tenantId },
      // relations: ['parent', 'children', 'tenant'],
    });
  }

  findByParent(parentId: string): Promise<ReasonCode[]> {
    // Note: parentId doesn't exist in database schema
    // This method is not supported
    return Promise.resolve([]);
    // return this.reasonCodeRepository.find({
    //   where: { parentId },
    //   relations: ['parent', 'children', 'tenant'],
    // });
  }

  findRootCodes(tenantId: string): Promise<ReasonCode[]> {
    // Note: parentId doesn't exist in database schema
    // This method returns all codes for the tenant
    return this.reasonCodeRepository.find({
      where: { tenantId },
      // relations: ['parent', 'children', 'tenant'],
    });
  }
} 