import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { RCACauseCode } from './rca-cause-code.entity';
import { RealtimeGateway } from '../realtime.gateway';

interface CauseCodeFilters {
  tenantId?: string;
  // Note: parentId doesn't exist in database schema
  // parentId?: string;
  root?: boolean;
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

    // Note: parentId doesn't exist in database schema, so root filter is not supported
    // if (filters.root) {
    //   where.parentId = IsNull();
    // } else if (filters.parentId) {
    //   where.parentId = filters.parentId;
    // }

    return this.rcaCauseCodeRepository.find({
      where,
      order: { code: 'ASC' },
    });
  }

  findOne(id: string): Promise<RCACauseCode | null> {
    return this.rcaCauseCodeRepository.findOne({ where: { id } });
  }

  async create(data: Partial<RCACauseCode>): Promise<RCACauseCode> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const codeData: any = {
      id,
      code: data.code,
      name: data.name,
      description: data.description,
      category: data.category,
      tenantId: data.tenantId,
    };
    
    // Note: parentId doesn't exist in database schema
    // if (data.parentId !== undefined && data.parentId !== null && data.parentId !== '') {
    //   codeData.parentId = data.parentId;
    // }
    
    const code = this.rcaCauseCodeRepository.create(codeData);
    const saved = await this.rcaCauseCodeRepository.save(code) as unknown as RCACauseCode;
    this.realtimeGateway.broadcastEntityEvent('Created', 'rcaCauseCode', saved);
    return saved;
  }

  async update(id: string, data: Partial<RCACauseCode>): Promise<RCACauseCode | null> {
    const updateData: any = { ...data };
    // Note: parentId doesn't exist in database schema
    // if (data.parentId !== undefined) {
    //   if (data.parentId === '' || data.parentId === null) {
    //     updateData.parentId = null;
    //   } else {
    //     updateData.parentId = data.parentId;
    //   }
    // }
    await this.rcaCauseCodeRepository.update(id, updateData);
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

