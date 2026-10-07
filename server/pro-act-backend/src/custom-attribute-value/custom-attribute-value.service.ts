import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { CustomAttributeValue } from './custom-attribute-value.entity';
import { CreateCustomAttributeValueDto } from './dto/create-custom-attribute-value.dto';
import { UpdateCustomAttributeValueDto } from './dto/update-custom-attribute-value.dto';

@Injectable()
export class CustomAttributeValueService {
  constructor(
    @InjectRepository(CustomAttributeValue)
    private customAttributeValueRepository: Repository<CustomAttributeValue>,
  ) {}

  async create(createDto: CreateCustomAttributeValueDto): Promise<CustomAttributeValue> {
    const value = this.customAttributeValueRepository.create({
      id: randomUUID(),
      ...createDto,
    });
    return await this.customAttributeValueRepository.save(value);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; entityId?: string; entityType?: string; attributeDefinitionId?: string }): Promise<CustomAttributeValue[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.entityId) where.entityId = filters.entityId;
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.attributeDefinitionId) where.attributeDefinitionId = filters.attributeDefinitionId;
    return await this.customAttributeValueRepository.find({ where });
  }

  async findOne(id: string): Promise<CustomAttributeValue> {
    const value = await this.customAttributeValueRepository.findOne({ where: { id } });
    if (!value) {
      throw new NotFoundException(`Custom Attribute Value with ID ${id} not found`);
    }
    return value;
  }

  async update(id: string, updateDto: UpdateCustomAttributeValueDto): Promise<CustomAttributeValue> {
    const value = await this.findOne(id);
    Object.assign(value, updateDto);
    return await this.customAttributeValueRepository.save(value);
  }

  async remove(id: string): Promise<void> {
    const result = await this.customAttributeValueRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Custom Attribute Value with ID ${id} not found`);
    }
  }
}

