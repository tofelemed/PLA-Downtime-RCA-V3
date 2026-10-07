import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PISyncWatermark } from './pi-sync-watermark.entity';
import { CreatePISyncWatermarkDto } from './dto/create-pi-sync-watermark.dto';
import { UpdatePISyncWatermarkDto } from './dto/update-pi-sync-watermark.dto';

@Injectable()
export class PISyncWatermarkService {
  constructor(
    @InjectRepository(PISyncWatermark)
    private piSyncWatermarkRepository: Repository<PISyncWatermark>,
  ) {}

  async create(createDto: CreatePISyncWatermarkDto): Promise<PISyncWatermark> {
    const watermark = this.piSyncWatermarkRepository.create(createDto);
    return await this.piSyncWatermarkRepository.save(watermark);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; syncType?: string }): Promise<PISyncWatermark[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.syncType) where.syncType = filters.syncType;
    return await this.piSyncWatermarkRepository.find({ where });
  }

  async findOne(id: string): Promise<PISyncWatermark> {
    const watermark = await this.piSyncWatermarkRepository.findOne({ where: { id } });
    if (!watermark) {
      throw new NotFoundException(`PI Sync Watermark with ID ${id} not found`);
    }
    return watermark;
  }

  async update(id: string, updateDto: UpdatePISyncWatermarkDto): Promise<PISyncWatermark> {
    const watermark = await this.findOne(id);
    Object.assign(watermark, updateDto);
    return await this.piSyncWatermarkRepository.save(watermark);
  }

  async remove(id: string): Promise<void> {
    const result = await this.piSyncWatermarkRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`PI Sync Watermark with ID ${id} not found`);
    }
  }
}

