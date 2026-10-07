import {
  hierarchyMappingApi,
  SourceHierarchyMappingDto,
  CreateSourceHierarchyMappingDto,
  UpdateSourceHierarchyMappingDto,
  MappingRequest,
  HierarchyIds,
  SourceType,
  TargetType,
} from './api/hierarchyMappingApi';

/**
 * Hierarchy Mapping Service
 * Provides high-level interface for managing universal hierarchy mappings
 */
export class HierarchyMappingService {
  private static instance: HierarchyMappingService;

  static getInstance(): HierarchyMappingService {
    if (!HierarchyMappingService.instance) {
      HierarchyMappingService.instance = new HierarchyMappingService();
    }
    return HierarchyMappingService.instance;
  }

  /**
   * Create a new hierarchy mapping
   */
  async createMapping(data: CreateSourceHierarchyMappingDto): Promise<SourceHierarchyMappingDto> {
    try {
      return await hierarchyMappingApi.create(data);
    } catch (error: any) {
      console.error('Failed to create hierarchy mapping:', error);
      throw new Error(`Failed to create mapping: ${error.message}`);
    }
  }

  /**
   * Get all mappings for a tenant
   */
  async getMappings(
    tenantId: string,
    filters?: { sourceType?: string; isActive?: boolean }
  ): Promise<SourceHierarchyMappingDto[]> {
    try {
      return await hierarchyMappingApi.findAll(tenantId, filters);
    } catch (error: any) {
      console.error('Failed to fetch hierarchy mappings:', error);
      throw new Error(`Failed to fetch mappings: ${error.message}`);
    }
  }

  /**
   * Get a single mapping by ID
   */
  async getMapping(id: string): Promise<SourceHierarchyMappingDto> {
    try {
      return await hierarchyMappingApi.findOne(id);
    } catch (error: any) {
      console.error(`Failed to fetch hierarchy mapping ${id}:`, error);
      throw new Error(`Failed to fetch mapping: ${error.message}`);
    }
  }

  /**
   * Update a hierarchy mapping
   */
  async updateMapping(
    id: string,
    data: UpdateSourceHierarchyMappingDto
  ): Promise<SourceHierarchyMappingDto> {
    try {
      return await hierarchyMappingApi.update(id, data);
    } catch (error: any) {
      console.error(`Failed to update hierarchy mapping ${id}:`, error);
      throw new Error(`Failed to update mapping: ${error.message}`);
    }
  }

  /**
   * Delete a hierarchy mapping
   */
  async deleteMapping(id: string): Promise<void> {
    try {
      await hierarchyMappingApi.remove(id);
    } catch (error: any) {
      console.error(`Failed to delete hierarchy mapping ${id}:`, error);
      throw new Error(`Failed to delete mapping: ${error.message}`);
    }
  }

  /**
   * Find hierarchy mapping for an event
   * This is the core method that maps external source identifiers to internal hierarchy
   */
  async findHierarchyForEvent(request: MappingRequest): Promise<HierarchyIds | null> {
    try {
      return await hierarchyMappingApi.findMapping(request);
    } catch (error: any) {
      console.error('Failed to find hierarchy mapping:', error);
      // Return null if mapping not found (not an error)
      if (error.status === 404) {
        return null;
      }
      throw new Error(`Failed to find mapping: ${error.message}`);
    }
  }

  /**
   * Get mappings by source type
   */
  async getMappingsBySourceType(
    tenantId: string,
    sourceType: SourceType
  ): Promise<SourceHierarchyMappingDto[]> {
    return this.getMappings(tenantId, { sourceType });
  }

  /**
   * Get active mappings only
   */
  async getActiveMappings(tenantId: string): Promise<SourceHierarchyMappingDto[]> {
    return this.getMappings(tenantId, { isActive: true });
  }

  /**
   * Create a direct mapping (non-pattern)
   */
  async createDirectMapping(
    tenantId: string,
    sourceType: SourceType,
    sourceIdentifier: string,
    targetType: TargetType,
    targetId: string,
    options?: {
      sourcePath?: string;
      sourceConnectionId?: string;
      organizationId?: string;
      priority?: number;
      description?: string;
    }
  ): Promise<SourceHierarchyMappingDto> {
    return this.createMapping({
      sourceType,
      sourceIdentifier,
      sourcePath: options?.sourcePath,
      sourceConnectionId: options?.sourceConnectionId,
      targetType,
      targetId,
      tenantId,
      organizationId: options?.organizationId,
      isPattern: false,
      priority: options?.priority || 50,
      isActive: true,
      description: options?.description,
    });
  }

  /**
   * Create a pattern-based mapping
   */
  async createPatternMapping(
    tenantId: string,
    sourceType: SourceType,
    pattern: string,
    targetType: TargetType,
    targetId: string,
    options?: {
      sourcePath?: string;
      sourceConnectionId?: string;
      organizationId?: string;
      priority?: number;
      description?: string;
    }
  ): Promise<SourceHierarchyMappingDto> {
    return this.createMapping({
      sourceType,
      sourceIdentifier: pattern, // Use pattern as identifier for pattern mappings
      sourcePath: options?.sourcePath,
      sourceConnectionId: options?.sourceConnectionId,
      targetType,
      targetId,
      tenantId,
      organizationId: options?.organizationId,
      isPattern: true,
      pattern: pattern,
      priority: options?.priority || 50,
      isActive: true,
      description: options?.description,
    });
  }

  /**
   * Enable/disable a mapping
   */
  async toggleMapping(id: string, isActive: boolean): Promise<SourceHierarchyMappingDto> {
    return this.updateMapping(id, { isActive });
  }

  /**
   * Update mapping priority
   */
  async updatePriority(id: string, priority: number): Promise<SourceHierarchyMappingDto> {
    if (priority < 0 || priority > 100) {
      throw new Error('Priority must be between 0 and 100');
    }
    return this.updateMapping(id, { priority });
  }
}

// Export singleton instance
export const hierarchyMappingService = HierarchyMappingService.getInstance();

