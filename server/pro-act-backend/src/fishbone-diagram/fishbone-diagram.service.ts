import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FishboneDiagram } from './fishbone-diagram.entity';
import { CreateFishboneDiagramDto } from './dto/create-fishbone-diagram.dto';
import { UpdateFishboneDiagramDto } from './dto/update-fishbone-diagram.dto';

@Injectable()
export class FishboneDiagramService {
  constructor(
    @InjectRepository(FishboneDiagram)
    private fishboneDiagramRepository: Repository<FishboneDiagram>,
  ) {}

  async create(createDto: CreateFishboneDiagramDto): Promise<FishboneDiagram> {
    const diagram = this.fishboneDiagramRepository.create(createDto);
    return await this.fishboneDiagramRepository.save(diagram);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string; rcaId?: string }): Promise<FishboneDiagram[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    if (filters?.rcaId) where.rcaId = filters.rcaId;
    return await this.fishboneDiagramRepository.find({ where });
  }

  async findOne(id: string): Promise<FishboneDiagram> {
    const diagram = await this.fishboneDiagramRepository.findOne({ where: { id } });
    if (!diagram) {
      throw new NotFoundException(`Fishbone Diagram with ID ${id} not found`);
    }
    return diagram;
  }

  async update(id: string, updateDto: UpdateFishboneDiagramDto): Promise<FishboneDiagram> {
    const diagram = await this.findOne(id);
    Object.assign(diagram, updateDto);
    return await this.fishboneDiagramRepository.save(diagram);
  }

  async remove(id: string): Promise<void> {
    const result = await this.fishboneDiagramRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Fishbone Diagram with ID ${id} not found`);
    }
  }
}

