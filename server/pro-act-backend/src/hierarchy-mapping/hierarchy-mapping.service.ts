import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceHierarchyMapping } from './entities/source-hierarchy-mapping.entity';
import { LegacyMappingMirror } from '../source-mapping/legacy-mapping-mirror';
import { SourceMappingService } from '../source-mapping/source-mapping.service';
import { legacySourceSystem } from '../source-mapping/source-system';
import { HierarchyIds, MappingRequest } from './dto/hierarchy-ids.dto';
import { CreateSourceHierarchyMappingDto } from './dto/create-source-hierarchy-mapping.dto';
import { UpdateSourceHierarchyMappingDto } from './dto/update-source-hierarchy-mapping.dto';

@Injectable()
export class HierarchyMappingService {
  private readonly logger = new Logger(HierarchyMappingService.name);

  constructor(
    @InjectRepository(SourceHierarchyMapping)
    private readonly mappingRepository: Repository<SourceHierarchyMapping>,
    private readonly sourceMappings: SourceMappingService,
    private readonly mirror: LegacyMappingMirror,
  ) {}

  /**
   * Create a new hierarchy mapping
   */
  async create(createDto: CreateSourceHierarchyMappingDto): Promise<SourceHierarchyMapping> {
    const mapping = this.mappingRepository.create({
      ...createDto,
      isPattern: createDto.isPattern ?? false,
      priority: createDto.priority ?? 50,
      isActive: createDto.isActive ?? true,
    });
    const saved = await this.mappingRepository.save(mapping);
    await this.mirror.sync(saved);
    return saved;
  }

  /**
   * Find all mappings for a tenant
   */
  async findAll(tenantId: string, filters?: { sourceType?: string; isActive?: boolean }): Promise<SourceHierarchyMapping[]> {
    const queryBuilder = this.mappingRepository.createQueryBuilder('mapping')
      .where('mapping.tenantId = :tenantId', { tenantId });

    if (filters?.sourceType) {
      queryBuilder.andWhere('mapping.sourceType = :sourceType', { sourceType: filters.sourceType });
    }

    if (filters?.isActive !== undefined) {
      queryBuilder.andWhere('mapping.isActive = :isActive', { isActive: filters.isActive });
    }

    queryBuilder.orderBy('mapping.priority', 'DESC')
      .addOrderBy('mapping.createdAt', 'DESC');

    return await queryBuilder.getMany();
  }

  /**
   * Find a mapping by ID
   */
  async findOne(id: string): Promise<SourceHierarchyMapping> {
    const mapping = await this.mappingRepository.findOne({ where: { id } });
    if (!mapping) {
      throw new NotFoundException(`Mapping with ID ${id} not found`);
    }
    return mapping;
  }

  /**
   * Update a mapping
   */
  async update(id: string, updateDto: UpdateSourceHierarchyMappingDto): Promise<SourceHierarchyMapping> {
    const mapping = await this.findOne(id);
    Object.assign(mapping, updateDto);
    const saved = await this.mappingRepository.save(mapping);
    await this.mirror.sync(saved);
    return saved;
  }

  /**
   * Delete a mapping
   */
  async remove(id: string): Promise<void> {
    const mapping = await this.findOne(id);
    await this.mappingRepository.remove(mapping);
    await this.mirror.remove(id);
  }

  /**
   * v1 lookup, answered by the deterministic resolver of plan 1.3 (ING03): exact id → exact path →
   * pattern → AF binding; ambiguous or cross-tenant targets resolve to null. The old substring path
   * containment and per-call full-table scans are gone. The rules are those of the request's source
   * type (the word the mirror stores as `source_system`) plus the `*` rules.
   */
  async findHierarchyMapping(request: MappingRequest): Promise<HierarchyIds | null> {
    const resolver = await this.sourceMappings.loadResolver(
      request.tenantId,
      request.connectionId ?? null,
      new Date(),
      legacySourceSystem(request.sourceType),
    );
    const resolved = resolver.resolve({
      sourceId: request.sourceIdentifier,
      sourcePath: request.sourcePath,
      afElementWebIds: [request.sourceIdentifier],
    });
    if (resolved.status !== 'mapped') {
      this.logger.debug(
        `No unique hierarchy mapping for ${request.sourceType}:${request.sourceIdentifier} (${resolved.status})`,
      );
      return null;
    }
    return {
      tenantId: request.tenantId,
      unitId: resolved.unitId,
      assetId: resolved.assetId ?? undefined,
    };
  }
}
