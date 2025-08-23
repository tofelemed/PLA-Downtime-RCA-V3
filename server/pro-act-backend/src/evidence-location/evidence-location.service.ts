import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvidenceLocation } from './evidence-location.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class EvidenceLocationService {
  constructor(
    @InjectRepository(EvidenceLocation)
    private readonly locationRepository: Repository<EvidenceLocation>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<EvidenceLocation[]> {
    return this.locationRepository.find({
      relations: ['tenant'],
    });
  }

  findOne(id: string): Promise<EvidenceLocation | null> {
    return this.locationRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });
  }

  async create(data: Partial<EvidenceLocation>): Promise<EvidenceLocation> {
    const location = this.locationRepository.create(data);
    const saved = await this.locationRepository.save(location);
    this.realtimeGateway.broadcastEntityEvent('Created', 'evidenceLocation', saved);
    return saved;
  }

  async update(id: string, data: Partial<EvidenceLocation>): Promise<EvidenceLocation | null> {
    await this.locationRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'evidenceLocation', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const location = await this.findOne(id);
    await this.locationRepository.delete(id);
    if (location) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'evidenceLocation', { id });
    }
  }

  findByTenant(tenantId: string): Promise<EvidenceLocation[]> {
    return this.locationRepository.find({
      where: { tenantId },
      relations: ['tenant'],
    });
  }
} 