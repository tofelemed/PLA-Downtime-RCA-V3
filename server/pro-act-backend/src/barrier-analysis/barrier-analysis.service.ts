import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BarrierAnalysis } from './barrier-analysis.entity';
import { CreateBarrierAnalysisDto } from './dto/create-barrier-analysis.dto';
import { UpdateBarrierAnalysisDto } from './dto/update-barrier-analysis.dto';

@Injectable()
export class BarrierAnalysisService {
  constructor(
    @InjectRepository(BarrierAnalysis)
    private barrierAnalysisRepository: Repository<BarrierAnalysis>,
  ) {}

  async create(createDto: CreateBarrierAnalysisDto): Promise<BarrierAnalysis> {
    const analysis = this.barrierAnalysisRepository.create(createDto);
    return await this.barrierAnalysisRepository.save(analysis);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; rcaId?: string }): Promise<BarrierAnalysis[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.rcaId) where.rcaId = filters.rcaId;
    return await this.barrierAnalysisRepository.find({ where });
  }

  async findOne(id: string): Promise<BarrierAnalysis> {
    const analysis = await this.barrierAnalysisRepository.findOne({ where: { id } });
    if (!analysis) {
      throw new NotFoundException(`Barrier Analysis with ID ${id} not found`);
    }
    return analysis;
  }

  async update(id: string, updateDto: UpdateBarrierAnalysisDto): Promise<BarrierAnalysis> {
    const analysis = await this.findOne(id);
    Object.assign(analysis, updateDto);
    return await this.barrierAnalysisRepository.save(analysis);
  }

  async remove(id: string): Promise<void> {
    const result = await this.barrierAnalysisRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Barrier Analysis with ID ${id} not found`);
    }
  }
}

