import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { EvidenceLocation } from './evidence-location.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { findOrThrow } from '../common/helpers/find-or-throw';

@Injectable()
export class EvidenceLocationService {
  constructor(
    @InjectRepository(EvidenceLocation)
    private readonly locationRepository: Repository<EvidenceLocation>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<EvidenceLocation[]> {
    // Note: tenant relation doesn't exist in database schema
    return this.locationRepository.find({
      // relations: ['tenant'],
    });
  }

  findOne(id: string): Promise<EvidenceLocation | null> {
    // Note: tenant relation doesn't exist in database schema
    return this.locationRepository.findOne({
      where: { id },
      // relations: ['tenant'],
    });
  }

  async create(data: Partial<EvidenceLocation>): Promise<EvidenceLocation> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const location = this.locationRepository.create({ id, ...data });
    const saved = await this.locationRepository.save(location);
    this.realtimeGateway.broadcastEntityEvent('Created', 'evidenceLocation', saved);
    return saved;
  }

  async update(id: string, data: Partial<EvidenceLocation>): Promise<EvidenceLocation | null> {
    await findOrThrow(this.findOne(id), 'EvidenceLocation', id);
    await this.locationRepository.update(id, data);
    const updated = await findOrThrow(this.findOne(id), 'EvidenceLocation', id);
    this.realtimeGateway.broadcastEntityEvent('Updated', 'evidenceLocation', updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await findOrThrow(this.findOne(id), 'EvidenceLocation', id);
    await this.locationRepository.delete(id);
    this.realtimeGateway.broadcastEntityEvent('Deleted', 'evidenceLocation', { id });
  }

  findByTenant(tenantId: string): Promise<EvidenceLocation[]> {
    // Note: tenant relation doesn't exist in database schema
    return this.locationRepository.find({
      where: { tenantId },
      // relations: ['tenant'],
    });
  }
} 