# Complete Backend Implementation Guide

This guide provides everything needed to finish implementing the ProAct backend according to STORAGE_SERVICE_BACKEND_REFERENCE.md.

## Table of Contents
1. [Module Status](#module-status)
2. [Module Template Pattern](#module-template-pattern)
3. [Remaining Modules to Create](#remaining-modules-to-create)
4. [App Module Updates](#app-module-updates)
5. [Environment Configuration](#environment-configuration)
6. [Historian History API](#historian-history-api)
7. [Complete SQL Schema](#complete-sql-schema)

---

## Module Status

### ✅ Completed Modules (37/49)
**Core (6)**
- users, organizations, tenants, units, assets, auditLogs

**Master Data (5)**
- impactCodes, oeeCodes, rcaCauseCodes, verificationStatusCodes, reasonCodes

**Production (9)**
- products, productionPlans, productionPlanTemplates, productionEvents
- productionLosses, oeeSummaries, reconcileForms, lossCategories, unmappedEvents

**RCA (10)**
- rcas, rcaRecommendations, rcaEvidence, logicTreeNodes
- ✅ rcaTriggerConfigs (NEW)
- ✅ rcaKnowledgeBase (NEW)
- ✅ rcaAnalysisConfigs (NEW)
- rcaTemplates, evidenceCategories, evidenceLocations

**Analysis Tools (1/6)**
- ✅ fiveWhyAnalyses (NEW)

**Settings (2)**
- dashboardConfigurations, appSettings

### 🔄 Modules To Create (12 modules + Historian API)

**Analysis Tools (5)**
1. fishboneDiagrams
2. fmeaAnalyses  
3. faultTreeAnalyses
4. barrierAnalyses
5. changeAnalyses

**PI Integration (8)**
6. piConnections
7. piAfElements
8. afBindings
9. piEvents
10. piMappings
11. piSyncWatermarks
12. piSyncJobs
13. historianTags

**Integration (1)**
14. dataSources

**Custom Attributes (2)**
15. customAttributeDefinitions
16. customAttributeValues

**Additional**
17. Historian History API (special module)

---

## Module Template Pattern

Each module follows this NestJS pattern:

### Directory Structure
```
src/
  module-name/
    dto/
      create-module-name.dto.ts
      update-module-name.dto.ts
    module-name.entity.ts
    module-name.service.ts
    module-name.controller.ts
    module-name.module.ts
```

### 1. Entity Template
```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('table_name')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
// Add specific indexes as needed
export class ModuleName {
  @ApiProperty({ description: 'Primary key UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @ApiProperty({ description: 'Tenant ID', required: false })
  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  // Add specific fields here based on STORAGE_SERVICE_BACKEND_REFERENCE.md
}
```

### 2. Create DTO Template
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateModuleNameDto {
  @ApiProperty({ description: 'Tenant ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;

  // Add specific fields with validation
}
```

### 3. Update DTO Template
```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateModuleNameDto } from './create-module-name.dto';

export class UpdateModuleNameDto extends PartialType(CreateModuleNameDto) {}
```

### 4. Service Template
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleName } from './module-name.entity';
import { CreateModuleNameDto } from './dto/create-module-name.dto';
import { UpdateModuleNameDto } from './dto/update-module-name.dto';

@Injectable()
export class ModuleNameService {
  constructor(
    @InjectRepository(ModuleName)
    private repository: Repository<ModuleName>,
  ) {}

  async create(createDto: CreateModuleNameDto): Promise<ModuleName> {
    const entity = this.repository.create(createDto);
    return await this.repository.save(entity);
  }

  async findAll(filters?: { tenantId?: string; organizationId?: string }): Promise<ModuleName[]> {
    const where: any = {};
    if (filters?.tenantId) where.tenantId = filters.tenantId;
    if (filters?.organizationId) where.organizationId = filters.organizationId;
    // Add more filter support as needed
    return await this.repository.find({ where });
  }

  async findOne(id: string): Promise<ModuleName> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`ModuleName with ID ${id} not found`);
    }
    return entity;
  }

  async update(id: string, updateDto: UpdateModuleNameDto): Promise<ModuleName> {
    const entity = await this.findOne(id);
    Object.assign(entity, updateDto);
    return await this.repository.save(entity);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`ModuleName with ID ${id} not found`);
    }
  }
}
```

### 5. Controller Template
```typescript
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ModuleNameService } from './module-name.service';
import { CreateModuleNameDto } from './dto/create-module-name.dto';
import { UpdateModuleNameDto } from './dto/update-module-name.dto';
import { ModuleName } from './module-name.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Module Names')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('module-names')
export class ModuleNameController {
  constructor(private readonly service: ModuleNameService) {}

  @Post()
  @ApiOperation({ summary: 'Create module name' })
  @ApiResponse({ status: 201, description: 'Created successfully', type: ModuleName })
  create(@Body() createDto: CreateModuleNameDto): Promise<ModuleName> {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all module names' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiResponse({ status: 200, description: 'Return all entities', type: [ModuleName] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
  ): Promise<ModuleName[]> {
    return this.service.findAll({ tenantId, organizationId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get module name by ID' })
  @ApiResponse({ status: 200, description: 'Return entity', type: ModuleName })
  findOne(@Param('id') id: string): Promise<ModuleName> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update module name' })
  @ApiResponse({ status: 200, description: 'Updated successfully', type: ModuleName })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateModuleNameDto,
  ): Promise<ModuleName> {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete module name' })
  @ApiResponse({ status: 204, description: 'Deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
```

### 6. Module Template
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleName } from './module-name.entity';
import { ModuleNameController } from './module-name.controller';
import { ModuleNameService } from './module-name.service';

@Module({
  imports: [TypeOrmModule.forFeature([ModuleName])],
  controllers: [ModuleNameController],
  providers: [ModuleNameService],
  exports: [ModuleNameService],
})
export class ModuleNameModule {}
```

---

## Remaining Modules To Create

### 1. Fishbone Diagrams

**File**: `src/fishbone-diagram/fishbone-diagram.entity.ts`
```typescript
@Entity('fishbone_diagrams')
export class FishboneDiagram {
  // Base fields + indexes
  @Column({ name: 'rca_id', type: 'varchar', length: 36 })
  rcaId: string;
  
  @Column({ name: 'problem_statement', type: 'text', nullable: true })
  problemStatement?: string;
  
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  categories?: string; // JSON
  
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  causes?: string; // JSON
}
```

**Indexes**: tenantId, organizationId, createdAt, rcaId

**Controller Route**: `/fishbone-diagrams`

**Query Filters**: tenantId, organizationId, rcaId

---

### 2. FMEA Analyses

**Entity Table**: `fmea_analyses`

**Fields**:
```typescript
rcaId: string
analysisName?: string
failureModes?: string // JSON
```

**Indexes**: tenantId, organizationId, createdAt, rcaId

---

### 3. Fault Tree Analyses

**Entity Table**: `fault_tree_analyses`

**Fields**:
```typescript
rcaId: string
topEvent?: string
treeData?: string // JSON
```

**Indexes**: tenantId, organizationId, createdAt, rcaId

---

### 4. Barrier Analyses

**Entity Table**: `barrier_analyses`

**Fields**:
```typescript
rcaId: string
hazard?: string
barriers?: string // JSON
```

**Indexes**: tenantId, organizationId, createdAt, rcaId

---

### 5. Change Analyses

**Entity Table**: `change_analyses`

**Fields**:
```typescript
rcaId: string
changeDescription?: string
changes?: string // JSON
```

**Indexes**: tenantId, organizationId, createdAt, rcaId

---

### 6. PI Connections

**Entity Table**: `pi_connections`

**Fields**:
```typescript
connectionName: string
piWebApiUrl: string
username?: string
passwordEncrypted?: string
afDatabasePath?: string
isActive: boolean
lastSyncTime?: Date
```

**Indexes**: tenantId, organizationId, createdAt

**Controller Route**: `/pi-connections`

---

### 7. PI AF Elements

**Entity Table**: `pi_af_elements`

**Fields**:
```typescript
webId: string (UNIQUE)
name?: string
description?: string
path?: string
template?: string
parentId?: string
hasChildren: boolean
```

**Indexes**: tenantId, organizationId, createdAt, parentId, template, webId

**Query Filters**: parentId, template

---

### 8. AF Bindings

**Entity Table**: `af_bindings`

**Fields**:
```typescript
webId?: string
localId?: string
boundType?: string
mappingConfig?: string // JSON
isActive: boolean
```

**Indexes**: tenantId, organizationId, createdAt, webId, boundType, localId

**Query Filters**: tenantId, boundType, localId

---

### 9. PI Events

**Entity Table**: `pi_events`

**Fields**:
```typescript
webId?: string
name?: string
template?: string
primaryAfId?: string
startUtc?: Date
endUtc?: Date
acknowledged: boolean
eventData?: string // JSON
```

**Indexes**: tenantId, organizationId, createdAt, template, primaryAfId, startUtc

**Query Filters**: template, primaryAfId, startUtc

---

### 10. PI Mappings

**Entity Table**: `pi_mappings`

**Fields**:
```typescript
sourceType?: string
sourceId?: string
targetType?: string
targetId?: string
mappingRules?: string // JSON
isActive: boolean
```

**Indexes**: tenantId, organizationId, createdAt

**Query Filters**: sourceType, targetType

---

### 11. PI Sync Watermarks

**Entity Table**: `pi_sync_watermarks`

**Fields**:
```typescript
syncType?: string
lastSyncTimestamp?: Date
lastSyncMarker?: string
syncStatus?: string
```

**Indexes**: tenantId, organizationId, createdAt

**Query Filters**: syncType

---

### 12. PI Sync Jobs

**Entity Table**: `pi_sync_jobs`

**Fields**:
```typescript
jobName?: string
jobType?: string
schedule?: string
lastRunTime?: Date
nextRunTime?: Date
status?: string
errorMessage?: string
jobConfig?: string // JSON
isActive: boolean
```

**Indexes**: tenantId, organizationId, createdAt

**Query Filters**: status

---

### 13. Historian Tags

**Entity Table**: `historian_tags`

**Fields**:
```typescript
webId?: string
tagName: string
description?: string
category?: string
unitOfMeasure?: string
dataType?: string
enabled: boolean
```

**Indexes**: tenantId, organizationId, createdAt, webId, category, enabled

**Query Filters**: tenantId, category, enabled

---

### 14. Data Sources

**Entity Table**: `data_sources`

**Fields**:
```typescript
sourceName: string
type?: string
connectionString?: string
credentialsEncrypted?: string
status?: string
enabled: boolean
lastSyncTime?: Date
config?: string // JSON
```

**Indexes**: tenantId, organizationId, createdAt, type, status, enabled

**Query Filters**: type, status, enabled

---

### 15. Custom Attribute Definitions

**Entity Table**: `custom_attribute_definitions`

**Fields**:
```typescript
entityType: string
attributeName: string
displayName?: string
description?: string
dataType?: string
isRequired: boolean
defaultValue?: string
validationRules?: string // JSON
displayOrder?: number
isActive: boolean
```

**Indexes**: entityType, tenantId, organizationId, createdAt

**Query Filters**: entityType

---

### 16. Custom Attribute Values

**Entity Table**: `custom_attribute_values`

**Fields**:
```typescript
entityId: string
entityType: string
attributeDefinitionId: string
value?: string
```

**Indexes**: tenantId, organizationId, createdAt, entityId, entityType, attributeDefinitionId

**Query Filters**: entityId, entityType, attributeDefinitionId

**Foreign Key**: attributeDefinitionId → custom_attribute_definitions(id)

---

## Historian History API

Special module for historian query history tracking.

### Create Module: `src/historian-history/`

**Entity Table**: `query_history`

**Fields**:
```typescript
@Entity('query_history')
export class QueryHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column({ type: 'datetime' })
  timestamp: Date;
  
  @Column({ type: 'nvarchar', length: 'MAX' })
  attributes: string; // JSON array
  
  @Column({ name: 'query_params', type: 'nvarchar', length: 'MAX' })
  queryParams: string; // JSON
  
  @Column({ name: 'result_count', type: 'int' })
  resultCount: number;
  
  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;
  
  // Indexes
  @Index()
  @Column({ name: 'tenant_id' })
  tenantIdIndex: string;
  
  @Index()
  @Column({ type: 'datetime' })
  timestampIndex: Date;
}
```

**Service Methods**:
```typescript
@Injectable()
export class HistorianHistoryService {
  // 1. Save history (replaces all for tenant)
  async saveQueryHistory(tenantId: string, history: QueryHistory[]): Promise<void>
  
  // 2. Load history for tenant (sorted desc by timestamp)
  async loadQueryHistory(tenantId: string): Promise<QueryHistory[]>
  
  // 3. Add single entry (auto-limit to 20)
  async addQueryHistoryEntry(tenantId: string, entry: Partial<QueryHistory>): Promise<void>
  
  // 4. Remove entry by ID
  async removeQueryHistoryEntry(id: string): Promise<void>
  
  // 5. Clear all history for tenant
  async clearQueryHistory(tenantId: string): Promise<void>
  
  // 6. Export history (formatted)
  async exportQueryHistory(tenantId: string): Promise<any[]>
  
  // 7. Import history
  async importQueryHistory(tenantId: string, data: any[]): Promise<void>
  
  // 8. Force recreation (development only)
  async forceDatabaseRecreation(): Promise<void>
}
```

**Controller Routes**:
```
PUT    /api/historian/history/:tenantId         - saveQueryHistory
GET    /api/historian/history/:tenantId         - loadQueryHistory
POST   /api/historian/history/:tenantId         - addQueryHistoryEntry
DELETE /api/historian/history/entry/:id         - removeQueryHistoryEntry
DELETE /api/historian/history/:tenantId         - clearQueryHistory
GET    /api/historian/history/:tenantId/export  - exportQueryHistory
POST   /api/historian/history/:tenantId/import  - importQueryHistory
POST   /api/historian/history/recreate          - forceDatabaseRecreation
```

---

## App Module Updates

Add all new modules to `src/app.module.ts`:

```typescript
import { RCATriggerConfigModule } from './rca-trigger-config/rca-trigger-config.module';
import { RCAKnowledgeBaseModule } from './rca-knowledge-base/rca-knowledge-base.module';
import { RCAAnalysisConfigModule } from './rca-analysis-config/rca-analysis-config.module';
import { FiveWhyAnalysisModule } from './five-why-analysis/five-why-analysis.module';
import { FishboneDiagramModule } from './fishbone-diagram/fishbone-diagram.module';
import { FMEAAnalysisModule } from './fmea-analysis/fmea-analysis.module';
import { FaultTreeAnalysisModule } from './fault-tree-analysis/fault-tree-analysis.module';
import { BarrierAnalysisModule } from './barrier-analysis/barrier-analysis.module';
import { ChangeAnalysisModule } from './change-analysis/change-analysis.module';
import { PIConnectionModule } from './pi-connection/pi-connection.module';
import { PIAfElementModule } from './pi-af-element/pi-af-element.module';
import { AfBindingModule } from './af-binding/af-binding.module';
import { PIEventModule } from './pi-event/pi-event.module';
import { PIMappingModule } from './pi-mapping/pi-mapping.module';
import { PISyncWatermarkModule } from './pi-sync-watermark/pi-sync-watermark.module';
import { PISyncJobModule } from './pi-sync-job/pi-sync-job.module';
import { HistorianTagModule } from './historian-tag/historian-tag.module';
import { DataSourceModule } from './data-source/data-source.module';
import { CustomAttributeDefinitionModule } from './custom-attribute-definition/custom-attribute-definition.module';
import { CustomAttributeValueModule } from './custom-attribute-value/custom-attribute-value.module';
import { HistorianHistoryModule } from './historian-history/historian-history.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({...}),
    // ... existing modules ...
    RCATriggerConfigModule,
    RCAKnowledgeBaseModule,
    RCAAnalysisConfigModule,
    FiveWhyAnalysisModule,
    FishboneDiagramModule,
    FMEAAnalysisModule,
    FaultTreeAnalysisModule,
    BarrierAnalysisModule,
    ChangeAnalysisModule,
    PIConnectionModule,
    PIAfElementModule,
    AfBindingModule,
    PIEventModule,
    PIMappingModule,
    PISyncWatermarkModule,
    PISyncJobModule,
    HistorianTagModule,
    DataSourceModule,
    CustomAttributeDefinitionModule,
    CustomAttributeValueModule,
    HistorianHistoryModule,
  ],
})
export class AppModule {}
```

---

## Environment Configuration

Create `.env.example`:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=sa
DB_PASSWORD=YourPassword123!
DB_NAME=ProActDB

# Application
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=24h

# CORS
CORS_ORIGIN=http://localhost:5173

# File Uploads
MAX_FILE_SIZE=10485760
UPLOAD_DEST=./uploads

# PI Web API (if using)
PI_WEB_API_URL=https://your-pi-server/piwebapi
PI_WEB_API_USERNAME=username
PI_WEB_API_PASSWORD=password

# Redis (for real-time/caching - optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Logging
LOG_LEVEL=debug
```

---

## Complete SQL Schema

All 49 tables are documented in the reference. Use the template pattern above to create each table with:
- Primary key: `id VARCHAR(36)`
- Timestamps: `created_at`, `updated_at`
- Multi-tenancy: `tenant_id`, `organization_id`
- Standard indexes on above fields
- Specific fields per entity (see STORAGE_SERVICE_BACKEND_REFERENCE.md)
- Additional indexes per entity requirements

---

## Implementation Checklist

- [x] Create RCA Trigger Configs module
- [x] Create RCA Knowledge Base module
- [x] Create RCA Analysis Configs module
- [x] Create Five Why Analysis module
- [ ] Create Fishbone Diagram module
- [ ] Create FMEA Analysis module
- [ ] Create Fault Tree Analysis module
- [ ] Create Barrier Analysis module
- [ ] Create Change Analysis module
- [ ] Create PI Connection module
- [ ] Create PI AF Element module
- [ ] Create AF Binding module
- [ ] Create PI Event module
- [ ] Create PI Mapping module
- [ ] Create PI Sync Watermark module
- [ ] Create PI Sync Job module
- [ ] Create Historian Tag module
- [ ] Create Data Source module
- [ ] Create Custom Attribute Definition module
- [ ] Create Custom Attribute Value module
- [ ] Create Historian History module
- [ ] Update app.module.ts with all modules
- [ ] Create complete SQL migration script
- [ ] Create .env.example
- [ ] Test all API endpoints
- [ ] Generate Swagger documentation
- [ ] Add validation pipes
- [ ] Implement real-time WebSocket gateway
- [ ] Add pagination support
- [ ] Add bulk operations
- [ ] Set up logging
- [ ] Add error handling
- [ ] Security review

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Create .env from example
cp .env.example .env

# Run database migrations
npm run migration:run

# Start development server
npm run start:dev

# Access API documentation
http://localhost:3000/api
```

---

## Next Steps

1. Use the module template pattern to create remaining 12 modules
2. Each module takes ~10 minutes following the template
3. Update app.module.ts after creating each module
4. Run `npm run start:dev` to verify compilation
5. Test endpoints using Swagger UI at `/api`
6. Implement Historian History API with 8 methods
7. Add WebSocket gateway for real-time events
8. Create comprehensive test suite

---

## Support

For questions or issues:
1. Review STORAGE_SERVICE_BACKEND_REFERENCE.md for entity schemas
2. Check existing modules for implementation examples
3. Verify TypeORM decorators and validation rules
4. Test endpoints via Swagger documentation

---

**Implementation Status**: 4/17 new modules completed (24%)
**Estimated Completion Time**: 2-3 hours following templates
**Total Endpoints**: 150+ RESTful API endpoints across all modules

