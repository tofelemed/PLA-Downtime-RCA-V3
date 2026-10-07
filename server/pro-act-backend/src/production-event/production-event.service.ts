import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ProductionEvent } from './production-event.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { CreateProductionEventDto } from './dto/create-production-event.dto';
import { UpdateProductionEventDto } from './dto/update-production-event.dto';
import { RcaAutoCreateService } from '../rca/rca-auto-create.service';

@Injectable()
export class ProductionEventService {
  private readonly logger = new Logger(ProductionEventService.name);

  constructor(
    @InjectRepository(ProductionEvent)
    private readonly eventRepository: Repository<ProductionEvent>,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly rcaAutoCreateService: RcaAutoCreateService,
  ) {}

  findAll(): Promise<ProductionEvent[]> {
    return this.eventRepository.find({
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode'], // Removed 'rca', 'reasonCode' - causing column errors
    });
  }

  findOne(id: string): Promise<ProductionEvent | null> {
    return this.eventRepository.findOne({
      where: { id },
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode'], // Removed 'rca', 'reasonCode' - causing column errors
    });
  }

  async create(data: CreateProductionEventDto): Promise<ProductionEvent> {
    // Convert string dates to Date objects for database
    const eventData: any = { id: randomUUID(), ...data };
    if (typeof data.startTime === 'string') {
      eventData.startTime = new Date(data.startTime);
    }
    if (data.endTime && typeof data.endTime === 'string') {
      eventData.endTime = new Date(data.endTime);
    }
    const event = this.eventRepository.create(eventData);
    const saved = await this.eventRepository.save(event);
    // TypeORM save() can return array or single entity, but we pass single entity so get first if array
    const result = Array.isArray(saved) ? saved[0] : saved;
    this.realtimeGateway.broadcastEntityEvent('Created', 'productionEvent', result);
    this.realtimeGateway.broadcastProductionEventCreated(result);

    try {
      const autoRca = await this.rcaAutoCreateService.tryCreateForEvent(result);
      if (autoRca.created) {
        this.logger.log(`RCA auto-created for event ${result.id}: ${autoRca.rcaId}`);
      }
    } catch (error: any) {
      this.logger.warn(`RCA auto-create skipped for event ${result.id}: ${error.message}`);
    }

    return result;
  }

  async update(id: string, data: UpdateProductionEventDto): Promise<ProductionEvent | null> {
    // Convert string dates to Date objects for database
    const updateData: any = { ...data };
    if (data.startTime && typeof data.startTime === 'string') {
      updateData.startTime = new Date(data.startTime);
    }
    if (data.endTime && typeof data.endTime === 'string') {
      updateData.endTime = new Date(data.endTime);
    }
    await this.eventRepository.update(id, updateData);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'productionEvent', updated);
      this.realtimeGateway.broadcastProductionEventUpdated(updated);
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
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode'], // Removed 'rca', 'reasonCode'
    });
  }

  findByStatus(status: string): Promise<ProductionEvent[]> {
    return this.eventRepository.find({
      where: { status },
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode'], // Removed 'rca', 'reasonCode'
    });
  }

  findByEventType(eventType: string): Promise<ProductionEvent[]> {
    return this.eventRepository.find({
      where: { eventType },
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode'], // Removed 'rca', 'reasonCode'
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
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode'], // Removed 'rca', 'reasonCode'
    });
  }

  findByTenant(tenantId: string): Promise<ProductionEvent[]> {
    return this.eventRepository.find({
      where: { tenantId },
      relations: ['plan', 'unit', 'asset', 'impactCode', 'oeeCode'], // Removed 'rca', 'reasonCode'
    });
  }
} 