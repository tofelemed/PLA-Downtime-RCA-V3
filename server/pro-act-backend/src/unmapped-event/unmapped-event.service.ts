import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnmappedEvent } from './unmapped-event.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class UnmappedEventService {
  constructor(
    @InjectRepository(UnmappedEvent)
    private readonly eventRepository: Repository<UnmappedEvent>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<UnmappedEvent[]> {
    return this.eventRepository.find({ relations: ['tenant', 'unit'] });
  }

  findOne(id: string): Promise<UnmappedEvent | null> {
    return this.eventRepository.findOne({ where: { id }, relations: ['tenant', 'unit'] });
  }

  async create(data: Partial<UnmappedEvent>): Promise<UnmappedEvent> {
    const event = this.eventRepository.create(data);
    const saved = await this.eventRepository.save(event);
    this.realtimeGateway.broadcastEntityEvent('Created', 'unmappedEvent', saved);
    return saved;
  }

  async update(id: string, data: Partial<UnmappedEvent>): Promise<UnmappedEvent | null> {
    await this.eventRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'unmappedEvent', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepository.delete(id);
    if (event) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'unmappedEvent', { id });
    }
  }

  findByTenant(tenantId: string): Promise<UnmappedEvent[]> {
    return this.eventRepository.find({ where: { tenantId }, relations: ['tenant', 'unit'] });
  }

  findByUnit(unitId: string): Promise<UnmappedEvent[]> {
    return this.eventRepository.find({ where: { unitId }, relations: ['tenant', 'unit'] });
  }
} 