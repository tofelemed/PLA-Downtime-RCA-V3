import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeAnalysis } from './change-analysis.entity';
import { CreateChangeAnalysisDto } from './dto/create-change-analysis.dto';
import { UpdateChangeAnalysisDto } from './dto/update-change-analysis.dto';

@Injectable()
export class ChangeAnalysisService {
  constructor(
    @InjectRepository(ChangeAnalysis)
    private changeAnalysisRepository: Repository<ChangeAnalysis>,
  ) {}

  async create(createDto: CreateChangeAnalysisDto): Promise<ChangeAnalysis> {
    const analysis = this.changeAnalysisRepository.create(createDto);
    return await this.changeAnalysisRepository.save(analysis);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; rcaId?: string }): Promise<ChangeAnalysis[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.rcaId) where.rcaId = filters.rcaId;
    return await this.changeAnalysisRepository.find({ where });
  }

  async findOne(id: string): Promise<ChangeAnalysis> {
    const analysis = await this.changeAnalysisRepository.findOne({ where: { id } });
    if (!analysis) {
      throw new NotFoundException(`Change Analysis with ID ${id} not found`);
    }
    return analysis;
  }

  async update(id: string, updateDto: UpdateChangeAnalysisDto): Promise<ChangeAnalysis> {
    const analysis = await this.findOne(id);
    Object.assign(analysis, updateDto);
    return await this.changeAnalysisRepository.save(analysis);
  }

  async remove(id: string): Promise<void> {
    const result = await this.changeAnalysisRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Change Analysis with ID ${id} not found`);
    }
  }
}

