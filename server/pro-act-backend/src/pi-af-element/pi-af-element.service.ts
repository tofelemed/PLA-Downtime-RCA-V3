import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PIAfElement } from './pi-af-element.entity';
import { CreatePIAfElementDto } from './dto/create-pi-af-element.dto';
import { UpdatePIAfElementDto } from './dto/update-pi-af-element.dto';

@Injectable()
export class PIAfElementService {
  constructor(
    @InjectRepository(PIAfElement)
    private piAfElementRepository: Repository<PIAfElement>,
  ) {}

  async create(createDto: CreatePIAfElementDto): Promise<PIAfElement> {
    const element = this.piAfElementRepository.create({
      ...createDto,
      categories: createDto.categories,
      metadata: createDto.metadata,
    });
    return await this.piAfElementRepository.save(element);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; parentId?: string; template?: string; webId?: string }): Promise<PIAfElement[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.parentId) where.parentId = filters.parentId;
    if (filters?.template) where.template = filters.template;
    if (filters?.webId) where.webId = filters.webId;
    return await this.piAfElementRepository.find({ where });
  }

  async findOne(id: string): Promise<PIAfElement> {
    const element = await this.piAfElementRepository.findOne({ where: { id } });
    if (!element) {
      throw new NotFoundException(`PI AF Element with ID ${id} not found`);
    }
    return element;
  }

  async update(id: string, updateDto: UpdatePIAfElementDto): Promise<PIAfElement> {
    const element = await this.findOne(id);
    Object.assign(element, {
      ...updateDto,
      ...(updateDto.categories !== undefined ? { categories: updateDto.categories } : {}),
      ...(updateDto.metadata !== undefined ? { metadata: updateDto.metadata } : {}),
    });
    return await this.piAfElementRepository.save(element);
  }

  async remove(id: string): Promise<void> {
    const result = await this.piAfElementRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`PI AF Element with ID ${id} not found`);
    }
  }
}

