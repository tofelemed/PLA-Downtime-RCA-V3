import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { CustomAttributeDefinition } from './custom-attribute-definition.entity';
import { CreateCustomAttributeDefinitionDto } from './dto/create-custom-attribute-definition.dto';
import { UpdateCustomAttributeDefinitionDto } from './dto/update-custom-attribute-definition.dto';

@Injectable()
export class CustomAttributeDefinitionService {
  constructor(
    @InjectRepository(CustomAttributeDefinition)
    private customAttributeDefinitionRepository: Repository<CustomAttributeDefinition>,
  ) {}

  async create(createDto: CreateCustomAttributeDefinitionDto): Promise<CustomAttributeDefinition> {
    const definitionData: Partial<CustomAttributeDefinition> = {
      entityType: createDto.entityType,
      attributeName: createDto.attributeName,
      displayName: createDto.displayName,
      description: createDto.description,
      dataType: createDto.dataType,
      isRequired: createDto.isRequired,
      defaultValue: createDto.defaultValue,
      displayOrder: createDto.displayOrder,
      isActive: createDto.isActive ?? true,
      createdBy: createDto.createdBy,
      tenantId: createDto.tenantId,
      organizationId: createDto.organizationId,
    };
    
    if (createDto.validationRules !== undefined) {
      definitionData.validationRules = createDto.validationRules
        ? JSON.stringify(createDto.validationRules)
        : undefined;
    }
    
    if (createDto.selectOptions !== undefined) {
      definitionData.selectOptions = createDto.selectOptions
        ? JSON.stringify(createDto.selectOptions)
        : undefined;
    }
    
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const definition = this.customAttributeDefinitionRepository.create({
      id,
      ...definitionData,
    });
    return await this.customAttributeDefinitionRepository.save(definition);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; entityType?: string }): Promise<CustomAttributeDefinition[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.entityType) where.entityType = filters.entityType;
    return await this.customAttributeDefinitionRepository.find({ where });
  }

  async findOne(id: string): Promise<CustomAttributeDefinition> {
    const definition = await this.customAttributeDefinitionRepository.findOne({ where: { id } });
    if (!definition) {
      throw new NotFoundException(`Custom Attribute Definition with ID ${id} not found`);
    }
    return definition;
  }

  async update(id: string, updateDto: UpdateCustomAttributeDefinitionDto): Promise<CustomAttributeDefinition> {
    const definition = await this.findOne(id);
    Object.assign(definition, {
      ...updateDto,
      ...(updateDto.validationRules !== undefined
        ? {
            validationRules: updateDto.validationRules
              ? JSON.stringify(updateDto.validationRules)
              : null,
          }
        : {}),
      ...(updateDto.selectOptions !== undefined
        ? {
            selectOptions: updateDto.selectOptions
              ? JSON.stringify(updateDto.selectOptions)
              : null,
          }
        : {}),
    });
    return await this.customAttributeDefinitionRepository.save(definition);
  }

  async remove(id: string): Promise<void> {
    const result = await this.customAttributeDefinitionRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Custom Attribute Definition with ID ${id} not found`);
    }
  }
}

