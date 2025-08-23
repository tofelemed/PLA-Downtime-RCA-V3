import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionEvent } from './production-event.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class ProductionEventService {
  constructor(
    @InjectRepository(ProductionEvent)
    private readonly eventRepository: Repository<ProductionEvent>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<ProductionEvent[]> {
    return this.eventRepository.find({
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode', 'rca', 'reasonCode'],
    });
  }

  findOne(id: string): Promise<ProductionEvent | null> {
    return this.eventRepository.findOne({
      where: { id },
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode', 'rca', 'reasonCode'],
    });
  }

  async create(data: Partial<ProductionEvent>): Promise<ProductionEvent> {
    const event = this.eventRepository.create(data);
    const saved = await this.eventRepository.save(event);
    this.realtimeGateway.broadcastEntityEvent('Created', 'productionEvent', saved);
    return saved;
  }

  async update(id: string, data: Partial<ProductionEvent>): Promise<ProductionEvent | null> {
    await this.eventRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'productionEvent', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepository.delete(id);
    if (event) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'productionEvent', { id });
    }
  }

  findByUnit(unitId: string): Promise<ProductionEvent[]> {
    return this.eventRepository.find({
      where: { unitId },
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode', 'rca', 'reasonCode'],
    });
  }

  findByStatus(status: string): Promise<ProductionEvent[]> {
    return this.eventRepository.find({
      where: { status },
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode', 'rca', 'reasonCode'],
    });
  }

  findByEventType(eventType: string): Promise<ProductionEvent[]> {
    return this.eventRepository.find({
      where: { eventType },
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode', 'rca', 'reasonCode'],
    });
  }

  findByDateRange(startDate: Date, endDate: Date): Promise<ProductionEvent[]> {
    return this.eventRepository.find({
      where: {
        startTime: {
          $gte: startDate,
          $lte: endDate,
        } as any,
      },
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode', 'rca', 'reasonCode'],
    });
  }
} 