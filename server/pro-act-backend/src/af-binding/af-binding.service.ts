import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AfBinding } from './af-binding.entity';
import { CreateAfBindingDto } from './dto/create-af-binding.dto';
import { UpdateAfBindingDto } from './dto/update-af-binding.dto';

@Injectable()
export class AfBindingService {
  constructor(
    @InjectRepository(AfBinding)
    private afBindingRepository: Repository<AfBinding>,
  ) {}

  async create(createDto: CreateAfBindingDto): Promise<AfBinding> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const binding = this.afBindingRepository.create({
      id,
      ...createDto,
    });
    return await this.afBindingRepository.save(binding);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; boundType?: string; localId?: string }): Promise<AfBinding[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.boundType) where.boundType = filters.boundType;
    if (filters?.localId) where.localId = filters.localId;
    return await this.afBindingRepository.find({ where });
  }

  async findOne(id: string): Promise<AfBinding> {
    const binding = await this.afBindingRepository.findOne({ where: { id } });
    if (!binding) {
      throw new NotFoundException(`AF Binding with ID ${id} not found`);
    }
    return binding;
  }

  async update(id: string, updateDto: UpdateAfBindingDto): Promise<AfBinding> {
    const binding = await this.findOne(id);
    Object.assign(binding, updateDto);
    return await this.afBindingRepository.save(binding);
  }

  async remove(id: string): Promise<void> {
    const result = await this.afBindingRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`AF Binding with ID ${id} not found`);
    }
  }
}

