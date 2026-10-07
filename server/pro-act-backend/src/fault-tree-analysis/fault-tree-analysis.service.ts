import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaultTreeAnalysis } from './fault-tree-analysis.entity';
import { CreateFaultTreeAnalysisDto } from './dto/create-fault-tree-analysis.dto';
import { UpdateFaultTreeAnalysisDto } from './dto/update-fault-tree-analysis.dto';

@Injectable()
export class FaultTreeAnalysisService {
  constructor(
    @InjectRepository(FaultTreeAnalysis)
    private faultTreeAnalysisRepository: Repository<FaultTreeAnalysis>,
  ) {}

  async create(createDto: CreateFaultTreeAnalysisDto): Promise<FaultTreeAnalysis> {
    const analysis = this.faultTreeAnalysisRepository.create(createDto);
    return await this.faultTreeAnalysisRepository.save(analysis);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; rcaId?: string }): Promise<FaultTreeAnalysis[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.rcaId) where.rcaId = filters.rcaId;
    return await this.faultTreeAnalysisRepository.find({ where });
  }

  async findOne(id: string): Promise<FaultTreeAnalysis> {
    const analysis = await this.faultTreeAnalysisRepository.findOne({ where: { id } });
    if (!analysis) {
      throw new NotFoundException(`Fault Tree Analysis with ID ${id} not found`);
    }
    return analysis;
  }

  async update(id: string, updateDto: UpdateFaultTreeAnalysisDto): Promise<FaultTreeAnalysis> {
    const analysis = await this.findOne(id);
    Object.assign(analysis, updateDto);
    return await this.faultTreeAnalysisRepository.save(analysis);
  }

  async remove(id: string): Promise<void> {
    const result = await this.faultTreeAnalysisRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Fault Tree Analysis with ID ${id} not found`);
    }
  }
}

