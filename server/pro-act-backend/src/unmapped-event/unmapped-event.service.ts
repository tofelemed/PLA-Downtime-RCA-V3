import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { UnmappedEvent } from './unmapped-event.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { CreateUnmappedEventDto } from './dto/create-unmapped-event.dto';
import { findOrThrow } from '../common/helpers/find-or-throw';

@Injectable()
export class UnmappedEventService {
  private readonly logger = new Logger(UnmappedEventService.name);

  constructor(
    @InjectRepository(UnmappedEvent)
    private readonly eventRepository: Repository<UnmappedEvent>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<UnmappedEvent[]> {
    return this.eventRepository.find({ order: { createdAt: 'DESC' } });
  }

  findOne(id: string): Promise<UnmappedEvent | null> {
    return this.eventRepository.findOne({ where: { id } });
  }

  findByTenant(tenantId: string): Promise<UnmappedEvent[]> {
    return this.eventRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  findByUnit(unitId: string): Promise<UnmappedEvent[]> {
    return this.eventRepository.find({
      where: { unitId },
      order: { createdAt: 'DESC' },
    });
  }

  findBySourceId(
    tenantId: string,
    sourceSystem: string,
    sourceId: string,
  ): Promise<UnmappedEvent | null> {
    return this.eventRepository.findOne({
      where: { tenantId, sourceSystem, sourceId },
    });
  }

  async create(
    data: CreateUnmappedEventDto | Partial<UnmappedEvent>,
  ): Promise<UnmappedEvent> {
    const payload: Partial<UnmappedEvent> = {
      id: randomUUID(),
      ...data,
      startTime: data.startTime
        ? typeof data.startTime === 'string'
          ? new Date(data.startTime)
          : data.startTime
        : undefined,
      endTime: data.endTime
        ? typeof data.endTime === 'string'
          ? new Date(data.endTime)
          : data.endTime
        : undefined,
    };

    const event = this.eventRepository.create(payload);
    const saved = await this.eventRepository.save(event);
    this.realtimeGateway.broadcastEntityEvent(
      'Created',
      'unmappedEvent',
      saved,
    );
    return saved;
  }

  async upsertBySource(
    data: CreateUnmappedEventDto,
  ): Promise<'created' | 'updated'> {
    if (data.tenantId && data.sourceSystem && data.sourceId) {
      const existing = await this.findBySourceId(
        data.tenantId,
        data.sourceSystem,
        data.sourceId,
      );
      if (existing) {
        await this.update(existing.id, data);
        return 'updated';
      }
    }
    await this.create(data);
    return 'created';
  }

  async update(
    id: string,
    data: Partial<UnmappedEvent> | CreateUnmappedEventDto,
  ): Promise<UnmappedEvent | null> {
    const updatePayload: Partial<UnmappedEvent> = {
      ...data,
    } as Partial<UnmappedEvent>;
    if (data.startTime) {
      updatePayload.startTime =
        typeof data.startTime === 'string'
          ? new Date(data.startTime)
          : data.startTime;
    }
    if (data.endTime) {
      updatePayload.endTime =
        typeof data.endTime === 'string'
          ? new Date(data.endTime)
          : data.endTime;
    }

    await findOrThrow(this.findOne(id), 'UnmappedEvent', id);
    await this.eventRepository.update(id, updatePayload);
    const updated = await findOrThrow(this.findOne(id), 'UnmappedEvent', id);
    this.realtimeGateway.broadcastEntityEvent(
      'Updated',
      'unmappedEvent',
      updated,
    );
    return updated;
  }

  async remove(id: string): Promise<void> {
    await findOrThrow(this.findOne(id), 'UnmappedEvent', id);
    await this.eventRepository.delete(id);
    this.realtimeGateway.broadcastEntityEvent('Deleted', 'unmappedEvent', {
      id,
    });
  }
}
