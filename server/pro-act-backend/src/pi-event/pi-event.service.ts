import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PIEvent } from './pi-event.entity';
import { CreatePIEventDto } from './dto/create-pi-event.dto';
import { UpdatePIEventDto } from './dto/update-pi-event.dto';

@Injectable()
export class PIEventService {
  constructor(
    @InjectRepository(PIEvent)
    private piEventRepository: Repository<PIEvent>,
  ) {}

  async create(createDto: CreatePIEventDto): Promise<PIEvent> {
    const event = this.piEventRepository.create({
      ...createDto,
      eventData: createDto.eventData,
    });
    return await this.piEventRepository.save(event);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; template?: string; primaryAfId?: string; startUtc?: string; webId?: string }): Promise<PIEvent[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.template) where.template = filters.template;
    if (filters?.primaryAfId) where.primaryAfId = filters.primaryAfId;
    if (filters?.startUtc) where.startUtc = filters.startUtc;
    if (filters?.webId) where.webId = filters.webId;
    return await this.piEventRepository.find({ where });
  }

  async findOne(id: string): Promise<PIEvent> {
    const event = await this.piEventRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`PI Event with ID ${id} not found`);
    }
    return event;
  }

  async update(id: string, updateDto: UpdatePIEventDto): Promise<PIEvent> {
    const event = await this.findOne(id);
    Object.assign(event, {
      ...updateDto,
      ...(updateDto.eventData !== undefined ? { eventData: updateDto.eventData } : {}),
    });
    return await this.piEventRepository.save(event);
  }

  async remove(id: string): Promise<void> {
    const result = await this.piEventRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`PI Event with ID ${id} not found`);
    }
  }
}

