import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSource } from './data-source.entity';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';

@Injectable()
export class DataSourceService {
  constructor(
    @InjectRepository(DataSource)
    private dataSourceRepository: Repository<DataSource>,
  ) {}

  async create(createDto: CreateDataSourceDto): Promise<DataSource> {
    const source = this.dataSourceRepository.create(createDto);
    return await this.dataSourceRepository.save(source);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; type?: string; status?: string; enabled?: boolean }): Promise<DataSource[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.enabled !== undefined) where.enabled = filters.enabled;
    return await this.dataSourceRepository.find({ where });
  }

  async findOne(id: string): Promise<DataSource> {
    const source = await this.dataSourceRepository.findOne({ where: { id } });
    if (!source) {
      throw new NotFoundException(`Data Source with ID ${id} not found`);
    }
    return source;
  }

  async update(id: string, updateDto: UpdateDataSourceDto): Promise<DataSource> {
    const source = await this.findOne(id);
    Object.assign(source, updateDto);
    return await this.dataSourceRepository.save(source);
  }

  async remove(id: string): Promise<void> {
    const result = await this.dataSourceRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Data Source with ID ${id} not found`);
    }
  }
}

