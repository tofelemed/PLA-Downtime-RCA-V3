import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { PISyncJob } from './pi-sync-job.entity';
import { CreatePISyncJobDto } from './dto/create-pi-sync-job.dto';
import { UpdatePISyncJobDto } from './dto/update-pi-sync-job.dto';

@Injectable()
export class PISyncJobService {
  constructor(
    @InjectRepository(PISyncJob)
    private piSyncJobRepository: Repository<PISyncJob>,
  ) {}

  async create(createDto: CreatePISyncJobDto): Promise<PISyncJob> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const job = this.piSyncJobRepository.create({
      id,
      ...createDto,
    });
    return await this.piSyncJobRepository.save(job);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; status?: string }): Promise<PISyncJob[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.status === 'enabled') where.isActive = true;
    else if (filters?.status === 'disabled') where.isActive = false;
    else if (filters?.status) where.status = filters.status;
    return await this.piSyncJobRepository.find({ where });
  }

  async findOne(id: string): Promise<PISyncJob> {
    const job = await this.piSyncJobRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException(`PI Sync Job with ID ${id} not found`);
    }
    return job;
  }

  async update(id: string, updateDto: UpdatePISyncJobDto): Promise<PISyncJob> {
    const job = await this.findOne(id);
    Object.assign(job, updateDto);
    return await this.piSyncJobRepository.save(job);
  }

  async remove(id: string): Promise<void> {
    const result = await this.piSyncJobRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`PI Sync Job with ID ${id} not found`);
    }
  }
}

