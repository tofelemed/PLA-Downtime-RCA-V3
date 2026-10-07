import { httpClient } from './httpClient';

export type SourceType = 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | 'Database' | 'RESTAPI' | 'SystemIntegration' | '*';
export type TargetType = 'unit' | 'asset' | 'tenant' | 'organization';

export interface SourceHierarchyMappingDto {
  id: string;
  sourceType: SourceType;
  sourceConnectionId?: string;
  sourceIdentifier: string;
  sourcePath?: string;
  targetType: TargetType;
  targetId: string;
  tenantId: string;
  organizationId?: string;
  isPattern: boolean;
  pattern?: string;
  priority: number;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSourceHierarchyMappingDto {
  sourceType: SourceType;
  sourceConnectionId?: string;
  sourceIdentifier: string;
  sourcePath?: string;
  targetType: TargetType;
  targetId: string;
  tenantId: string;
  organizationId?: string;
  isPattern?: boolean;
  pattern?: string;
  priority?: number;
  isActive?: boolean;
  description?: string;
}

export interface UpdateSourceHierarchyMappingDto extends Partial<CreateSourceHierarchyMappingDto> {}

export interface MappingRequest {
  sourceType: string;
  sourceIdentifier: string;
  sourcePath?: string;
  connectionId?: string;
  tenantId: string;
}

export interface HierarchyIds {
  tenantId?: string;
  organizationId?: string;
  unitId?: string;
  assetId?: string;
}

export interface HierarchyMappingFilters {
  sourceType?: string;
  isActive?: boolean;
}

export const hierarchyMappingApi = {
  /**
   * Create a new hierarchy mapping
   */
  async create(data: CreateSourceHierarchyMappingDto): Promise<SourceHierarchyMappingDto> {
    const response = await httpClient.post<SourceHierarchyMappingDto>('/hierarchy-mappings', data);
    return response.data;
  },

  /**
   * Get all hierarchy mappings for a tenant
   */
  async findAll(tenantId: string, filters?: HierarchyMappingFilters): Promise<SourceHierarchyMappingDto[]> {
    const params: Record<string, any> = { tenantId };
    if (filters?.sourceType) {
      params.sourceType = filters.sourceType;
    }
    if (filters?.isActive !== undefined) {
      params.isActive = filters.isActive;
    }
    const response = await httpClient.get<SourceHierarchyMappingDto[]>('/hierarchy-mappings', {
      params,
    });
    return response.data;
  },

  /**
   * Get a hierarchy mapping by ID
   */
  async findOne(id: string): Promise<SourceHierarchyMappingDto> {
    const response = await httpClient.get<SourceHierarchyMappingDto>(`/hierarchy-mappings/${id}`);
    return response.data;
  },

  /**
   * Update a hierarchy mapping
   */
  async update(id: string, data: UpdateSourceHierarchyMappingDto): Promise<SourceHierarchyMappingDto> {
    const response = await httpClient.put<SourceHierarchyMappingDto>(`/hierarchy-mappings/${id}`, data);
    return response.data;
  },

  /**
   * Delete a hierarchy mapping
   */
  async remove(id: string): Promise<void> {
    await httpClient.delete(`/hierarchy-mappings/${id}`);
  },

  /**
   * Find hierarchy mapping for an event
   * This is the core method that returns hierarchy IDs based on source event data
   */
  async findMapping(request: MappingRequest): Promise<HierarchyIds | null> {
    const response = await httpClient.post<HierarchyIds | null>('/hierarchy-mappings/find-mapping', request);
    return response.data;
  },
};

