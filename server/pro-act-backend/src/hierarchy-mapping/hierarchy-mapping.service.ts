import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceHierarchyMapping, SourceType } from './entities/source-hierarchy-mapping.entity';
import { HierarchyIds, MappingRequest } from './dto/hierarchy-ids.dto';
import { CreateSourceHierarchyMappingDto } from './dto/create-source-hierarchy-mapping.dto';
import { UpdateSourceHierarchyMappingDto } from './dto/update-source-hierarchy-mapping.dto';

@Injectable()
export class HierarchyMappingService {
  private readonly logger = new Logger(HierarchyMappingService.name);

  constructor(
    @InjectRepository(SourceHierarchyMapping)
    private readonly mappingRepository: Repository<SourceHierarchyMapping>,
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
    return await this.mappingRepository.save(mapping);
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
    return await this.mappingRepository.save(mapping);
  }

  /**
   * Delete a mapping
   */
  async remove(id: string): Promise<void> {
    const mapping = await this.findOne(id);
    await this.mappingRepository.remove(mapping);
  }

  /**
   * Find hierarchy mapping for an event (Priority-based lookup)
   * This is the core method that implements the mapping algorithm
   */
  async findHierarchyMapping(request: MappingRequest): Promise<HierarchyIds | null> {
    const { sourceType, sourceIdentifier, sourcePath, connectionId, tenantId } = request;

    // Load ALL mappings for this tenant (optimized: cache in production)
    const allMappings = await this.mappingRepository.find({
      where: { tenantId, isActive: true },
      order: { priority: 'DESC' },
    });

    // Filter mappings by source type (support '*' wildcard for all sources)
    const mappings = allMappings.filter(m => {
      const mappingSourceType = m.sourceType as string;
      return mappingSourceType === sourceType || mappingSourceType === '*';
    });

    // Priority 1: Direct mapping (exact match)
    const directMatch = mappings.find(m => 
      !m.isPattern &&
      m.sourceIdentifier === sourceIdentifier &&
      (!m.sourceConnectionId || m.sourceConnectionId === connectionId)
    );

    if (directMatch) {
      return this.buildHierarchyIds(directMatch);
    }

    // Priority 2: Pattern matching
    const patternMappings = mappings.filter(m => m.isPattern && m.pattern);
    patternMappings.sort((a, b) => (b.priority || 50) - (a.priority || 50)); // Higher priority first

    for (const patternMapping of patternMappings) {
      if (this.matchesPattern(sourceIdentifier, patternMapping.pattern!, sourcePath)) {
        return this.buildHierarchyIds(patternMapping);
      }
    }

    // Priority 3: Hierarchical path parsing (if sourcePath is provided)
    if (sourcePath) {
      const pathBasedMapping = await this.parseHierarchyFromPath(sourceType, sourcePath, tenantId, mappings);
      if (pathBasedMapping) {
        return pathBasedMapping;
      }
    }

    // Priority 4: Connection defaults (if connectionId is provided)
    if (connectionId) {
      const connectionDefaults = await this.getConnectionDefaults(connectionId, sourceType, tenantId);
      if (connectionDefaults) {
        return connectionDefaults;
      }
    }

    // No mapping found
    this.logger.debug(`No hierarchy mapping found for ${sourceType}:${sourceIdentifier}`);
    return null;
  }

  /**
   * Build HierarchyIds from a mapping
   */
  private buildHierarchyIds(mapping: SourceHierarchyMapping): HierarchyIds {
    const result: HierarchyIds = {
      tenantId: mapping.tenantId,
      organizationId: mapping.organizationId,
    };

    switch (mapping.targetType) {
      case 'organization':
        result.organizationId = mapping.targetId;
        break;
      case 'tenant':
        result.tenantId = mapping.targetId;
        break;
      case 'unit':
        result.unitId = mapping.targetId;
        break;
      case 'asset':
        result.assetId = mapping.targetId;
        break;
    }

    return result;
  }

  /**
   * Check if a source identifier matches a pattern
   */
  private matchesPattern(identifier: string, pattern: string, sourcePath?: string): boolean {
    // Convert pattern to regex
    // Escape special characters except wildcards
    let regexPattern = pattern
      .replace(/\\/g, '/') // Normalize path separators
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\*/g, '.*') // * matches anything
      .replace(/\?/g, '.'); // ? matches single character

    // Try matching against identifier
    const identifierMatch = new RegExp(`^${regexPattern}$`, 'i').test(identifier);
    if (identifierMatch) {
      return true;
    }

    // Try matching against sourcePath if provided
    if (sourcePath) {
      const pathMatch = new RegExp(`^${regexPattern}$`, 'i').test(sourcePath);
      if (pathMatch) {
        return true;
      }
    }

    return false;
  }

  /**
   * Parse hierarchy from source path (template-based or level-based)
   * This is a simplified version - can be enhanced with template patterns
   */
  private async parseHierarchyFromPath(
    sourceType: string,
    sourcePath: string,
    tenantId: string,
    existingMappings: SourceHierarchyMapping[]
  ): Promise<HierarchyIds | null> {
    // For now, this is a placeholder
    // In the future, this can implement:
    // - Template pattern matching
    // - Level-based mapping
    // - Segment name matching
    // - Lookup tables

    // Look for path-based mappings in existing mappings
    const pathMappings = existingMappings.filter(m => 
      m.sourcePath && 
      (sourcePath.includes(m.sourcePath) || m.sourcePath.includes(sourcePath))
    );

    if (pathMappings.length > 0) {
      // Use the highest priority path mapping
      const bestMapping = pathMappings.sort((a, b) => (b.priority || 50) - (a.priority || 50))[0];
      return this.buildHierarchyIds(bestMapping);
    }

    return null;
  }

  /**
   * Get connection-level defaults
   * This would typically come from connection configuration
   */
  private async getConnectionDefaults(
    connectionId: string,
    sourceType: string,
    tenantId: string
  ): Promise<HierarchyIds | null> {
    // Look for connection-level default mappings
    const defaultMappings = await this.mappingRepository.find({
      where: {
        tenantId,
        sourceType: sourceType as any,
        sourceConnectionId: connectionId,
        isActive: true,
      },
      order: { priority: 'DESC' },
      take: 1,
    });

    if (defaultMappings.length > 0) {
      return this.buildHierarchyIds(defaultMappings[0]);
    }

    return null;
  }

  /**
   * Bulk tag events with hierarchy IDs
   * Optimized for processing many events at once
   */
  async bulkTagEvents(events: Array<{
    sourceType: string;
    sourceIdentifier: string;
    sourcePath?: string;
    connectionId?: string;
    tenantId: string;
  }>): Promise<Array<HierarchyIds | null>> {
    // Group events by tenant for efficient querying
    const eventsByTenant = new Map<string, typeof events>();
    for (const event of events) {
      if (!eventsByTenant.has(event.tenantId)) {
        eventsByTenant.set(event.tenantId, []);
      }
      eventsByTenant.get(event.tenantId)!.push(event);
    }

    // Process each tenant's events
    const results: Array<HierarchyIds | null> = [];
    for (const [tenantId, tenantEvents] of eventsByTenant) {
      // Load all mappings for this tenant once
      const allMappings = await this.mappingRepository.find({
        where: { tenantId, isActive: true },
        order: { priority: 'DESC' },
      });

      // Create lookup maps for fast access
      const directMappingMap = new Map<string, SourceHierarchyMapping>();
      const patternMappings: SourceHierarchyMapping[] = [];

      for (const mapping of allMappings) {
        if (mapping.isPattern) {
          patternMappings.push(mapping);
        } else {
          const key = `${mapping.sourceType}:${mapping.sourceIdentifier}`;
          directMappingMap.set(key, mapping);
        }
      }

      // Sort pattern mappings by priority
      patternMappings.sort((a, b) => (b.priority || 50) - (a.priority || 50));

      // Process each event
      for (const event of tenantEvents) {
        const mapping = await this.findMappingForEvent(event, directMappingMap, patternMappings);
        results.push(mapping);
      }
    }

    return results;
  }

  /**
   * Find mapping for a single event using pre-loaded mappings
   */
  private async findMappingForEvent(
    event: {
      sourceType: string;
      sourceIdentifier: string;
      sourcePath?: string;
      connectionId?: string;
    },
    directMappingMap: Map<string, SourceHierarchyMapping>,
    patternMappings: SourceHierarchyMapping[]
  ): Promise<HierarchyIds | null> {
    // Try direct mapping
    const directKey = `${event.sourceType}:${event.sourceIdentifier}`;
    const directMapping = directMappingMap.get(directKey);
    if (directMapping && (!directMapping.sourceConnectionId || directMapping.sourceConnectionId === event.connectionId)) {
      return this.buildHierarchyIds(directMapping);
    }

    // Try pattern matching
    for (const patternMapping of patternMappings) {
      const mappingSourceType = patternMapping.sourceType as string;
      if (mappingSourceType === event.sourceType || mappingSourceType === '*') {
        if (patternMapping.pattern && this.matchesPattern(event.sourceIdentifier, patternMapping.pattern, event.sourcePath)) {
          return this.buildHierarchyIds(patternMapping);
        }
      }
    }

    return null;
  }
}

