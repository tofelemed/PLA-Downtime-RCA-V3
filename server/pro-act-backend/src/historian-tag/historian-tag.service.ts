import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { HistorianTag } from './historian-tag.entity';
import { CreateHistorianTagDto } from './dto/create-historian-tag.dto';
import { UpdateHistorianTagDto } from './dto/update-historian-tag.dto';

@Injectable()
export class HistorianTagService {
  constructor(
    @InjectRepository(HistorianTag)
    private historianTagRepository: Repository<HistorianTag>,
  ) {}

  async create(createDto: CreateHistorianTagDto): Promise<HistorianTag> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const tag = this.historianTagRepository.create({
      id,
      ...createDto,
      config: createDto.config ? JSON.stringify(createDto.config) : createDto.config,
    });
    return await this.historianTagRepository.save(tag);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; category?: string; enabled?: boolean }): Promise<HistorianTag[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.category) where.category = filters.category;
    if (filters?.enabled !== undefined) where.enabled = filters.enabled;
    return await this.historianTagRepository.find({ where });
  }

  async findOne(id: string): Promise<HistorianTag> {
    const tag = await this.historianTagRepository.findOne({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`Historian Tag with ID ${id} not found`);
    }
    return tag;
  }

  async update(id: string, updateDto: UpdateHistorianTagDto): Promise<HistorianTag> {
    const tag = await this.findOne(id);
    Object.assign(tag, {
      ...updateDto,
      ...(updateDto.config !== undefined
        ? { config: updateDto.config ? JSON.stringify(updateDto.config) : null }
        : {}),
    });
    return await this.historianTagRepository.save(tag);
  }

  async remove(id: string): Promise<void> {
    const result = await this.historianTagRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Historian Tag with ID ${id} not found`);
    }
  }
}

