import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { RCACauseCode } from './rca-cause-code.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { findOrThrow } from '../common/helpers/find-or-throw';
import { assertValidCauseParent } from './rca-cause-parent';

interface CauseCodeFilters {
  tenantId?: string;
}

@Injectable()
export class RCACauseCodeService {
  constructor(
    @InjectRepository(RCACauseCode)
    private readonly rcaCauseCodeRepository: Repository<RCACauseCode>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(filters: CauseCodeFilters = {}): Promise<RCACauseCode[]> {
    const where: FindOptionsWhere<RCACauseCode> = {};

    if (filters.tenantId) {
      where.tenantId = filters.tenantId;
    }

    return this.rcaCauseCodeRepository.find({
      where,
      order: { code: 'ASC' },
    });
  }

  findOne(id: string): Promise<RCACauseCode | null> {
    return this.rcaCauseCodeRepository.findOne({ where: { id } });
  }

  async create(data: Partial<RCACauseCode>): Promise<RCACauseCode> {
    const parentId = data.parentId ?? null;
    if (parentId) {
      await assertValidCauseParent(
        this.rcaCauseCodeRepository,
        { tenantId: data.tenantId ?? null },
        parentId,
      );
    }
    const code = this.rcaCauseCodeRepository.create({
      id: randomUUID(),
      code: data.code,
      name: data.name,
      description: data.description,
      category: data.category,
      parentId,
      tenantId: data.tenantId,
    });
    const saved = await this.rcaCauseCodeRepository.save(code);
    this.realtimeGateway.broadcastEntityEvent('Created', 'rcaCauseCode', saved);
    return saved;
  }

  /** `parentId` re-parents the cause (null: root); the subtree moves with it. */
  async update(id: string, data: Partial<RCACauseCode>): Promise<RCACauseCode> {
    const existing = await findOrThrow(this.findOne(id), 'RCACauseCode', id);
    const parentId =
      data.parentId === undefined ? existing.parentId : data.parentId;
    const moved = data.parentId !== undefined || data.tenantId !== undefined;
    if (parentId && moved) {
      await assertValidCauseParent(
        this.rcaCauseCodeRepository,
        { id, tenantId: data.tenantId ?? existing.tenantId ?? null },
        parentId,
      );
    }
    await this.rcaCauseCodeRepository.update(id, data);
    const updated = await findOrThrow(this.findOne(id), 'RCACauseCode', id);
    this.realtimeGateway.broadcastEntityEvent('Updated', 'rcaCauseCode', updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await findOrThrow(this.findOne(id), 'RCACauseCode', id);
    await this.rcaCauseCodeRepository.delete(id);
    this.realtimeGateway.broadcastEntityEvent('Deleted', 'rcaCauseCode', { id });
  }
}

