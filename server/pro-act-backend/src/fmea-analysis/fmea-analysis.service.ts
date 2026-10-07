import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FMEAAnalysis } from './fmea-analysis.entity';
import { CreateFMEAAnalysisDto } from './dto/create-fmea-analysis.dto';
import { UpdateFMEAAnalysisDto } from './dto/update-fmea-analysis.dto';

@Injectable()
export class FMEAAnalysisService {
  constructor(
    @InjectRepository(FMEAAnalysis)
    private fmeaAnalysisRepository: Repository<FMEAAnalysis>,
  ) {}

  async create(createDto: CreateFMEAAnalysisDto): Promise<FMEAAnalysis> {
    const analysis = this.fmeaAnalysisRepository.create(createDto);
    return await this.fmeaAnalysisRepository.save(analysis);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; rcaId?: string }): Promise<FMEAAnalysis[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.rcaId) where.rcaId = filters.rcaId;
    return await this.fmeaAnalysisRepository.find({ where });
  }

  async findOne(id: string): Promise<FMEAAnalysis> {
    const analysis = await this.fmeaAnalysisRepository.findOne({ where: { id } });
    if (!analysis) {
      throw new NotFoundException(`FMEA Analysis with ID ${id} not found`);
    }
    return analysis;
  }

  async update(id: string, updateDto: UpdateFMEAAnalysisDto): Promise<FMEAAnalysis> {
    const analysis = await this.findOne(id);
    Object.assign(analysis, updateDto);
    return await this.fmeaAnalysisRepository.save(analysis);
  }

  async remove(id: string): Promise<void> {
    const result = await this.fmeaAnalysisRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`FMEA Analysis with ID ${id} not found`);
    }
  }
}

