import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FiveWhyAnalysis } from './five-why-analysis.entity';
import { CreateFiveWhyAnalysisDto } from './dto/create-five-why-analysis.dto';
import { UpdateFiveWhyAnalysisDto } from './dto/update-five-why-analysis.dto';

@Injectable()
export class FiveWhyAnalysisService {
  constructor(
    @InjectRepository(FiveWhyAnalysis)
    private fiveWhyAnalysisRepository: Repository<FiveWhyAnalysis>,
  ) {}

  async create(createDto: CreateFiveWhyAnalysisDto): Promise<FiveWhyAnalysis> {
    const analysis = this.fiveWhyAnalysisRepository.create(createDto);
    return await this.fiveWhyAnalysisRepository.save(analysis);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; rcaId?: string }): Promise<FiveWhyAnalysis[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.rcaId) where.rcaId = filters.rcaId;
    return await this.fiveWhyAnalysisRepository.find({ where });
  }

  async findOne(id: string): Promise<FiveWhyAnalysis> {
    const analysis = await this.fiveWhyAnalysisRepository.findOne({ where: { id } });
    if (!analysis) {
      throw new NotFoundException(`Five Why Analysis with ID ${id} not found`);
    }
    return analysis;
  }

  async update(id: string, updateDto: UpdateFiveWhyAnalysisDto): Promise<FiveWhyAnalysis> {
    const analysis = await this.findOne(id);
    Object.assign(analysis, updateDto);
    return await this.fiveWhyAnalysisRepository.save(analysis);
  }

  async remove(id: string): Promise<void> {
    const result = await this.fiveWhyAnalysisRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Five Why Analysis with ID ${id} not found`);
    }
  }
}

