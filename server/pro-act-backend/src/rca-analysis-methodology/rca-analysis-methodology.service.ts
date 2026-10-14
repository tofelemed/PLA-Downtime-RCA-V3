import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { randomUUID } from 'crypto';
import { RcaFiveWhyAnalysis } from './entities/five-why-analysis.entity';
import { CreateFiveWhyAnalysisDto } from './dto/create-five-why-analysis.dto';
import { UpdateFiveWhyAnalysisDto } from './dto/update-five-why-analysis.dto';
import { RcaFishboneDiagram } from './entities/fishbone-diagram.entity';
import { CreateFishboneDiagramDto } from './dto/create-fishbone-diagram.dto';
import { UpdateFishboneDiagramDto } from './dto/update-fishbone-diagram.dto';
import { RcaFmeaAnalysis } from './entities/fmea-analysis.entity';
import { CreateFmeaAnalysisDto } from './dto/create-fmea-analysis.dto';
import { UpdateFmeaAnalysisDto } from './dto/update-fmea-analysis.dto';
import { RcaFaultTreeAnalysis } from './entities/fault-tree-analysis.entity';
import { CreateFaultTreeAnalysisDto } from './dto/create-fault-tree-analysis.dto';
import { UpdateFaultTreeAnalysisDto } from './dto/update-fault-tree-analysis.dto';
import { RcaBarrierAnalysis } from './entities/barrier-analysis.entity';
import { CreateBarrierAnalysisDto } from './dto/create-barrier-analysis.dto';
import { UpdateBarrierAnalysisDto } from './dto/update-barrier-analysis.dto';
import { RcaChangeAnalysis } from './entities/change-analysis.entity';
import { CreateChangeAnalysisDto } from './dto/create-change-analysis.dto';
import { UpdateChangeAnalysisDto } from './dto/update-change-analysis.dto';
import { findOrThrow } from '../common/helpers/find-or-throw';
import { requireTenantId } from '../common/context/request-context';
import { RCA } from '../rca/rca.entity';

@Injectable()
export class RCAAnalysisMethodologyService {
  constructor(
    @InjectRepository(RcaFiveWhyAnalysis)
    private readonly fiveWhyRepository: Repository<RcaFiveWhyAnalysis>,
    @InjectRepository(RcaFishboneDiagram)
    private readonly fishboneRepository: Repository<RcaFishboneDiagram>,
    @InjectRepository(RcaFmeaAnalysis)
    private readonly fmeaRepository: Repository<RcaFmeaAnalysis>,
    @InjectRepository(RcaFaultTreeAnalysis)
    private readonly faultTreeRepository: Repository<RcaFaultTreeAnalysis>,
    @InjectRepository(RcaBarrierAnalysis)
    private readonly barrierRepository: Repository<RcaBarrierAnalysis>,
    @InjectRepository(RcaChangeAnalysis)
    private readonly changeRepository: Repository<RcaChangeAnalysis>,
    @InjectRepository(RCA)
    private readonly rcaRepository: Repository<RCA>,
  ) {}

  /**
   * The caller's plant, after checking the case is one of its cases (404 otherwise). The plant always comes
   * from the signed-in context: a `tenantId` in the body or query is ignored.
   */
  private async caseTenant(rcaId: string): Promise<string> {
    const tenantId = requireTenantId();
    if (!(await this.rcaRepository.exist({ where: { id: rcaId, tenantId } }))) {
      throw new NotFoundException(`RCA ${rcaId} not found`);
    }
    return tenantId;
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  // Five Why
  async createFiveWhy(
    dto: CreateFiveWhyAnalysisDto,
  ): Promise<RcaFiveWhyAnalysis> {
    const entity = this.fiveWhyRepository.create({
      id: randomUUID(),
      ...dto,
      tenantId: await this.caseTenant(dto.rcaId),
      whyLevels: dto.whyLevels ?? [],
      verifiedDate: this.parseDate(dto.verifiedDate),
    });
    return this.fiveWhyRepository.save(entity);
  }

  async findFiveWhyByRca(rcaId: string): Promise<RcaFiveWhyAnalysis | null> {
    const where: FindOptionsWhere<RcaFiveWhyAnalysis> = {
      rcaId,
      tenantId: requireTenantId(),
    };
    return this.fiveWhyRepository.findOne({ where });
  }

  async updateFiveWhy(
    id: string,
    dto: UpdateFiveWhyAnalysisDto,
  ): Promise<RcaFiveWhyAnalysis> {
    const existing = await this.fiveWhyRepository.findOne({
      where: { id, tenantId: requireTenantId() },
    });
    if (!existing) {
      throw new NotFoundException(`Five Why analysis ${id} not found`);
    }
    Object.assign(existing, {
      ...dto,
      whyLevels: dto.whyLevels ?? existing.whyLevels,
      verifiedDate: dto.verifiedDate
        ? this.parseDate(dto.verifiedDate)
        : existing.verifiedDate,
    });
    return this.fiveWhyRepository.save(existing);
  }

  async deleteFiveWhy(id: string): Promise<void> {
    await findOrThrow(
      this.fiveWhyRepository.findOneBy({ id, tenantId: requireTenantId() }),
      'FiveWhyAnalysis',
      id,
    );
    await this.fiveWhyRepository.delete(id);
  }

  // Fishbone
  async createFishbone(
    dto: CreateFishboneDiagramDto,
  ): Promise<RcaFishboneDiagram> {
    const entity = this.fishboneRepository.create({
      id: randomUUID(),
      ...dto,
      tenantId: await this.caseTenant(dto.rcaId),
      categories: dto.categories ?? [],
    });
    return this.fishboneRepository.save(entity);
  }

  async findFishboneByRca(rcaId: string): Promise<RcaFishboneDiagram | null> {
    const where: FindOptionsWhere<RcaFishboneDiagram> = {
      rcaId,
      tenantId: requireTenantId(),
    };
    return this.fishboneRepository.findOne({ where });
  }

  async updateFishbone(
    id: string,
    dto: UpdateFishboneDiagramDto,
  ): Promise<RcaFishboneDiagram> {
    const existing = await this.fishboneRepository.findOne({
      where: { id, tenantId: requireTenantId() },
    });
    if (!existing) {
      throw new NotFoundException(`Fishbone diagram ${id} not found`);
    }
    Object.assign(existing, {
      ...dto,
      categories: dto.categories ?? existing.categories,
    });
    return this.fishboneRepository.save(existing);
  }

  async deleteFishbone(id: string): Promise<void> {
    await findOrThrow(
      this.fishboneRepository.findOneBy({ id, tenantId: requireTenantId() }),
      'FishboneDiagram',
      id,
    );
    await this.fishboneRepository.delete(id);
  }

  // FMEA
  async createFmea(dto: CreateFmeaAnalysisDto): Promise<RcaFmeaAnalysis> {
    const entity = this.fmeaRepository.create({
      id: randomUUID(),
      ...dto,
      tenantId: await this.caseTenant(dto.rcaId),
      effects: dto.effects ?? [],
      causes: dto.causes ?? [],
    });
    return this.fmeaRepository.save(entity);
  }

  async findFmeaByRca(rcaId: string): Promise<RcaFmeaAnalysis | null> {
    const where: FindOptionsWhere<RcaFmeaAnalysis> = {
      rcaId,
      tenantId: requireTenantId(),
    };
    return this.fmeaRepository.findOne({ where });
  }

  async updateFmea(
    id: string,
    dto: UpdateFmeaAnalysisDto,
  ): Promise<RcaFmeaAnalysis> {
    const existing = await this.fmeaRepository.findOne({
      where: { id, tenantId: requireTenantId() },
    });
    if (!existing) {
      throw new NotFoundException(`FMEA analysis ${id} not found`);
    }
    Object.assign(existing, {
      ...dto,
      effects: dto.effects ?? existing.effects,
      causes: dto.causes ?? existing.causes,
    });
    return this.fmeaRepository.save(existing);
  }

  async deleteFmea(id: string): Promise<void> {
    await findOrThrow(
      this.fmeaRepository.findOneBy({ id, tenantId: requireTenantId() }),
      'FmeaAnalysis',
      id,
    );
    await this.fmeaRepository.delete(id);
  }

  // Fault tree
  async createFaultTree(
    dto: CreateFaultTreeAnalysisDto,
  ): Promise<RcaFaultTreeAnalysis> {
    const entity = this.faultTreeRepository.create({
      id: randomUUID(),
      ...dto,
      tenantId: await this.caseTenant(dto.rcaId),
      nodes: dto.nodes ?? [],
      minimumCutSets: dto.minimumCutSets ?? [],
    });
    return this.faultTreeRepository.save(entity);
  }

  async findFaultTreeByRca(
    rcaId: string,
  ): Promise<RcaFaultTreeAnalysis | null> {
    const where: FindOptionsWhere<RcaFaultTreeAnalysis> = {
      rcaId,
      tenantId: requireTenantId(),
    };
    return this.faultTreeRepository.findOne({ where });
  }

  async updateFaultTree(
    id: string,
    dto: UpdateFaultTreeAnalysisDto,
  ): Promise<RcaFaultTreeAnalysis> {
    const existing = await this.faultTreeRepository.findOne({
      where: { id, tenantId: requireTenantId() },
    });
    if (!existing) {
      throw new NotFoundException(`Fault tree analysis ${id} not found`);
    }
    Object.assign(existing, {
      ...dto,
      nodes: dto.nodes ?? existing.nodes,
      minimumCutSets: dto.minimumCutSets ?? existing.minimumCutSets,
    });
    return this.faultTreeRepository.save(existing);
  }

  async deleteFaultTree(id: string): Promise<void> {
    await findOrThrow(
      this.faultTreeRepository.findOneBy({ id, tenantId: requireTenantId() }),
      'FaultTreeAnalysis',
      id,
    );
    await this.faultTreeRepository.delete(id);
  }

  // Barrier
  async createBarrier(
    dto: CreateBarrierAnalysisDto,
  ): Promise<RcaBarrierAnalysis> {
    const entity = this.barrierRepository.create({
      id: randomUUID(),
      ...dto,
      tenantId: await this.caseTenant(dto.rcaId),
      barriers: dto.barriers ?? [],
    });
    return this.barrierRepository.save(entity);
  }

  async findBarrierByRca(rcaId: string): Promise<RcaBarrierAnalysis | null> {
    const where: FindOptionsWhere<RcaBarrierAnalysis> = {
      rcaId,
      tenantId: requireTenantId(),
    };
    return this.barrierRepository.findOne({ where });
  }

  async updateBarrier(
    id: string,
    dto: UpdateBarrierAnalysisDto,
  ): Promise<RcaBarrierAnalysis> {
    const existing = await this.barrierRepository.findOne({
      where: { id, tenantId: requireTenantId() },
    });
    if (!existing) {
      throw new NotFoundException(`Barrier analysis ${id} not found`);
    }
    Object.assign(existing, {
      ...dto,
      barriers: dto.barriers ?? existing.barriers,
    });
    return this.barrierRepository.save(existing);
  }

  async deleteBarrier(id: string): Promise<void> {
    await findOrThrow(
      this.barrierRepository.findOneBy({ id, tenantId: requireTenantId() }),
      'BarrierAnalysis',
      id,
    );
    await this.barrierRepository.delete(id);
  }

  // Change analysis
  async createChange(dto: CreateChangeAnalysisDto): Promise<RcaChangeAnalysis> {
    const entity = this.changeRepository.create({
      id: randomUUID(),
      ...dto,
      tenantId: await this.caseTenant(dto.rcaId),
      changes: dto.changes ?? [],
    });
    return this.changeRepository.save(entity);
  }

  async findChangeByRca(rcaId: string): Promise<RcaChangeAnalysis | null> {
    const where: FindOptionsWhere<RcaChangeAnalysis> = {
      rcaId,
      tenantId: requireTenantId(),
    };
    return this.changeRepository.findOne({ where });
  }

  async updateChange(
    id: string,
    dto: UpdateChangeAnalysisDto,
  ): Promise<RcaChangeAnalysis> {
    const existing = await this.changeRepository.findOne({
      where: { id, tenantId: requireTenantId() },
    });
    if (!existing) {
      throw new NotFoundException(`Change analysis ${id} not found`);
    }
    Object.assign(existing, {
      ...dto,
      changes: dto.changes ?? existing.changes,
    });
    return this.changeRepository.save(existing);
  }

  async deleteChange(id: string): Promise<void> {
    await findOrThrow(
      this.changeRepository.findOneBy({ id, tenantId: requireTenantId() }),
      'ChangeAnalysis',
      id,
    );
    await this.changeRepository.delete(id);
  }
}
