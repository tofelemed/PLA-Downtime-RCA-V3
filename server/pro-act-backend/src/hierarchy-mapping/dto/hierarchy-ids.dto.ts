import { ApiPropertyOptional } from '@nestjs/swagger';

export class HierarchyIds {
  @ApiPropertyOptional({ description: 'Organization ID' })
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Tenant ID' })
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Unit ID' })
  unitId?: string;

  @ApiPropertyOptional({ description: 'Asset ID' })
  assetId?: string;
}

export interface MappingRequest {
  sourceType: string;
  sourceIdentifier: string;
  sourcePath?: string;
  connectionId?: string;
  tenantId: string;
}
