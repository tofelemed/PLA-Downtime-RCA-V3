import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PIMapping } from './pi-mapping.entity';
import { CreatePIMappingDto } from './dto/create-pi-mapping.dto';
import { UpdatePIMappingDto } from './dto/update-pi-mapping.dto';

@Injectable()
export class PIMappingService {
  constructor(
    @InjectRepository(PIMapping)
    private piMappingRepository: Repository<PIMapping>,
  ) {}

  async create(createDto: CreatePIMappingDto): Promise<PIMapping> {
    const mapping = this.piMappingRepository.create(createDto);
    return await this.piMappingRepository.save(mapping);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; sourceType?: string; targetType?: string }): Promise<PIMapping[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.sourceType) where.sourceType = filters.sourceType;
    if (filters?.targetType) where.targetType = filters.targetType;
    return await this.piMappingRepository.find({ where });
  }

  async findOne(id: string): Promise<PIMapping> {
    const mapping = await this.piMappingRepository.findOne({ where: { id } });
    if (!mapping) {
      throw new NotFoundException(`PI Mapping with ID ${id} not found`);
    }
    return mapping;
  }

  async update(id: string, updateDto: UpdatePIMappingDto): Promise<PIMapping> {
    const mapping = await this.findOne(id);
    Object.assign(mapping, updateDto);
    return await this.piMappingRepository.save(mapping);
  }

  async remove(id: string): Promise<void> {
    const result = await this.piMappingRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`PI Mapping with ID ${id} not found`);
    }
  }
}

