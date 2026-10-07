import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { EvidenceCategory } from './evidence-category.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class EvidenceCategoryService {
  constructor(
    @InjectRepository(EvidenceCategory)
    private readonly categoryRepository: Repository<EvidenceCategory>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<EvidenceCategory[]> {
    // Note: tenant relation doesn't exist in database schema
    return this.categoryRepository.find({
      // relations: ['tenant'],
    });
  }

  findOne(id: string): Promise<EvidenceCategory | null> {
    // Note: tenant relation doesn't exist in database schema
    return this.categoryRepository.findOne({
      where: { id },
      // relations: ['tenant'],
    });
  }

  async create(data: Partial<EvidenceCategory>): Promise<EvidenceCategory> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const category = this.categoryRepository.create({ id, ...data });
    const saved = await this.categoryRepository.save(category);
    this.realtimeGateway.broadcastEntityEvent('Created', 'evidenceCategory', saved);
    return saved;
  }

  async update(id: string, data: Partial<EvidenceCategory>): Promise<EvidenceCategory | null> {
    await this.categoryRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'evidenceCategory', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.delete(id);
    if (category) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'evidenceCategory', { id });
    }
  }

  findByTenant(tenantId: string): Promise<EvidenceCategory[]> {
    // Note: tenant relation doesn't exist in database schema
    return this.categoryRepository.find({
      where: { tenantId },
      // relations: ['tenant'],
    });
  }
} 