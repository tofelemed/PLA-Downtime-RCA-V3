# 🗺️ Universal Hierarchy Mapping System - Design Document

## 📋 Problem Statement

**Challenge:**
- ProAct has **internal hierarchy**: Organization → Tenant → Unit → Asset
- External sources have **their own identifiers**:
  - **PI**: WebIds, Element Paths (e.g., "PI\\Plant1\\Line1\\Equipment")
  - **OPC UA**: NodeIds (e.g., "ns=2;s=Machine1.Temperature")
  - **Modbus**: Connection + Register (e.g., "Connection1:40001")
  - **MQTT**: Topics (e.g., "plant/unit1/sensor/temperature")
  - **Database**: Table/Row identifiers
  - **REST API**: Endpoint paths

**Question:** How to map **ANY** external source identifier to ProAct's internal hierarchy?

---

## 🏗️ Internal Hierarchy Structure

### **ProAct Hierarchy:**

```
Organization (id: org-123)
    ↓
Tenant (id: tenant-456, organizationId: org-123)
    ↓
Unit (id: unit-789, tenantId: tenant-456)
    ↓
Asset (id: asset-101, unitId: unit-789)
```

**Key Points:**
- Each level has UUID identifiers
- Hierarchical relationship (Unit belongs to Tenant, Asset belongs to Unit)
- Events must be tagged with: `tenantId`, `unitId`, `assetId`

---

## 🎯 Current State Analysis

### **✅ What Exists:**

1. **AF Bindings (PI Only):**
   ```typescript
   AfBinding {
     webId: "PI\\Plant1\\Line1"  // External PI identifier
     boundType: "unit"            // Maps to hierarchy level
     localId: "unit-789"          // Internal Unit ID
     tenantId: "tenant-456"
   }
   ```
   - ✅ Works for PI
   - ❌ Only for PI WebIds
   - ❌ Not universal

2. **Data Bindings (Connectivity):**
   ```typescript
   DataBinding {
     sourceOPCUAConnectionId: "..."
     sourcePath: "ns=2;s=Machine1"
     targetPath: "..."  // But not to hierarchy!
   }
   ```
   - ⚠️ Exists but doesn't map to hierarchy
   - ⚠️ Maps source → target connections, not source → hierarchy

---

## 🔧 Proposed Solution: Universal Source Mapping System

### **Concept: Unified Mapping Entity**

**Single table for ALL sources:**
```typescript
SourceHierarchyMapping {
  id: UUID
  
  // Source identification
  sourceType: 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | 'Database' | 'RESTAPI' | '*'
  sourceConnectionId?: UUID  // Optional: specific connection
  sourceIdentifier: string   // External identifier (WebId, NodeId, Topic, etc.)
  sourcePath?: string        // Optional: hierarchical path in source
  
  // Target hierarchy mapping
  targetType: 'unit' | 'asset' | 'tenant'  // What level in hierarchy
  targetId: UUID             // Unit ID, Asset ID, or Tenant ID
  
  // Context
  tenantId: UUID
  organizationId?: UUID
  
  // Pattern matching (for bulk mapping)
  isPattern: boolean         // Is this a pattern rule?
  pattern: string            // Pattern expression (e.g., "PI\\Plant1\\*")
  
  // Metadata
  priority: number           // Higher priority = checked first
  isActive: boolean
  description?: string
}
```

---

## 🗺️ Mapping Strategies

### **Strategy 1: Direct Mapping (Explicit Bindings)**

**For individual source identifiers:**

```
Example 1: PI Element
  sourceType: "PI"
  sourceIdentifier: "F1AbCdEfGhIjKlMnOpQrStUvWxYz"
  sourcePath: "PI\\Plant1\\Line1\\Equipment1"
  targetType: "asset"
  targetId: "asset-101"
  → Events from this PI element → asset-101

Example 2: OPC UA Node
  sourceType: "OPCUA"
  sourceConnectionId: "opcua-conn-123"
  sourceIdentifier: "ns=2;s=Machine1.Temperature"
  targetType: "asset"
  targetId: "asset-101"
  → Events from this OPC UA node → asset-101

Example 3: Modbus Register
  sourceType: "Modbus"
  sourceConnectionId: "modbus-conn-456"
  sourceIdentifier: "40001"  // Register address
  targetType: "unit"
  targetId: "unit-789"
  → Events from this register → unit-789

Example 4: MQTT Topic
  sourceType: "MQTT"
  sourceConnectionId: "mqtt-conn-789"
  sourceIdentifier: "plant/unit1/sensor/temperature"
  targetType: "asset"
  targetId: "asset-101"
  → Events from this topic → asset-101
```

---

### **Strategy 2: Pattern-Based Mapping (Bulk)**

**For mapping many similar identifiers at once:**

```
Example 1: PI Path Pattern
  isPattern: true
  pattern: "PI\\\\Plant1\\\\Line1\\\\*"
  targetType: "unit"
  targetId: "unit-789"
  → ALL PI elements under "PI\Plant1\Line1\" → unit-789

Example 2: OPC UA Namespace Pattern
  isPattern: true
  pattern: "ns=2;s=Machine1.*"
  targetType: "asset"
  targetId: "asset-101"
  → ALL OPC UA nodes starting with "ns=2;s=Machine1." → asset-101

Example 3: Modbus Register Range
  isPattern: true
  pattern: "Connection1:40001-40100"
  targetType: "unit"
  targetId: "unit-789"
  → ALL registers 40001-40100 → unit-789

Example 4: MQTT Topic Pattern
  isPattern: true
  pattern: "plant/unit1/**"
  targetType: "unit"
  targetId: "unit-789"
  → ALL MQTT topics under "plant/unit1/" → unit-789
```

---

### **Strategy 3: Hierarchical Path Parsing**

**Extract hierarchy from source path:**

```
Example: PI Path
  Source Path: "PI\\Acme Corp\\Plant A\\Production Line 1\\Machine 1"
  
  Mapping Rules:
    - Extract Organization: "Acme Corp" → Find by name → orgId
    - Extract Tenant: "Plant A" → Find by name under org → tenantId
    - Extract Unit: "Production Line 1" → Find by name under tenant → unitId
    - Extract Asset: "Machine 1" → Find by name under unit → assetId

Example: MQTT Topic
  Source Topic: "org/acme/plant/plant-a/unit/line-1/asset/machine-1/temp"
  
  Mapping Rules:
    - Parse topic structure
    - Extract hierarchy levels from topic segments
    - Map to internal hierarchy IDs
```

---

### **Strategy 4: Connection-Level Defaults**

**Default mapping for entire connection:**

```
Example: OPC UA Connection
  connectionId: "opcua-conn-123"
  defaultTenantId: "tenant-456"
  defaultUnitId: "unit-789"
  
  → All events from this connection → unit-789 (unless overridden)
```

---

## 📊 Universal Mapping Flow

### **Event Tagging Process:**

```
1. Event arrives from source
   ↓
2. Extract source identifier
   (WebId, NodeId, Topic, Register, etc.)
   ↓
3. Look up mapping (in priority order):
   a. Direct mapping (exact match)
   b. Pattern mapping (pattern match)
   c. Hierarchical parsing (path-based)
   d. Connection defaults
   ↓
4. Tag event with hierarchy IDs
   unitId, assetId, tenantId, organizationId
   ↓
5. Store event in database
```

---

## 🗄️ Database Schema Design

### **Universal Mapping Entity:**

```sql
CREATE TABLE source_hierarchy_mappings (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    
    -- Source identification
    source_type VARCHAR(50) NOT NULL,  -- 'PI', 'OPCUA', 'Modbus', 'MQTT', etc.
    source_connection_id UNIQUEIDENTIFIER NULL,  -- Optional: specific connection
    source_identifier NVARCHAR(1000) NOT NULL,  -- External identifier
    source_path NVARCHAR(1000) NULL,  -- Optional: full path
    
    -- Target hierarchy
    target_type VARCHAR(50) NOT NULL,  -- 'unit', 'asset', 'tenant'
    target_id UNIQUEIDENTIFIER NOT NULL,  -- Unit/Asset/Tenant ID
    
    -- Context
    tenant_id VARCHAR(36) NOT NULL,
    organization_id VARCHAR(36) NULL,
    
    -- Pattern matching
    is_pattern BIT DEFAULT 0,  -- Is this a pattern rule?
    pattern NVARCHAR(500) NULL,  -- Pattern expression
    priority INT DEFAULT 50,  -- Higher = checked first
    
    -- Metadata
    is_active BIT DEFAULT 1,
    description NVARCHAR(MAX) NULL,
    
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    
    -- Indexes
    INDEX idx_source_type (source_type),
    INDEX idx_target_type (target_type),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_source_identifier (source_identifier),
    INDEX idx_pattern (pattern),
    INDEX idx_priority (priority DESC)
);
```

---

## 🔍 Mapping Lookup Algorithm

### **Priority-Based Lookup:**

```typescript
async findHierarchyMapping(
  sourceType: string,
  sourceIdentifier: string,
  sourcePath?: string,
  connectionId?: string,
  tenantId: string
): Promise<HierarchyIds | null> {
  
  // 1. Load ALL mappings for this tenant (once)
  const mappings = await this.getMappings(tenantId);
  
  // 2. Try in priority order:
  
  // Priority 1: Direct mapping (exact match)
  const directMatch = mappings.find(m => 
    m.sourceType === sourceType &&
    m.sourceIdentifier === sourceIdentifier &&
    (!m.sourceConnectionId || m.sourceConnectionId === connectionId) &&
    !m.isPattern &&
    m.isActive
  );
  if (directMatch) {
    return {
      unitId: directMatch.targetType === 'unit' ? directMatch.targetId : undefined,
      assetId: directMatch.targetType === 'asset' ? directMatch.targetId : undefined,
      tenantId: directMatch.tenantId,
    };
  }
  
  // Priority 2: Pattern matching
  const patternMatches = mappings
    .filter(m => 
      m.sourceType === sourceType &&
      m.isPattern &&
      m.isActive
    )
    .sort((a, b) => b.priority - a.priority);  // Higher priority first
    
  for (const patternMapping of patternMatches) {
    if (matchesPattern(sourceIdentifier, patternMapping.pattern)) {
      return {
        unitId: patternMapping.targetType === 'unit' ? patternMapping.targetId : undefined,
        assetId: patternMapping.targetType === 'asset' ? patternMapping.targetId : undefined,
        tenantId: patternMapping.tenantId,
      };
    }
  }
  
  // Priority 3: Hierarchical path parsing
  if (sourcePath) {
    const pathBasedMapping = await this.parseHierarchyFromPath(
      sourceType,
      sourcePath,
      tenantId
    );
    if (pathBasedMapping) {
      return pathBasedMapping;
    }
  }
  
  // Priority 4: Connection defaults
  if (connectionId) {
    const connectionDefaults = await this.getConnectionDefaults(connectionId);
    if (connectionDefaults) {
      return connectionDefaults;
    }
  }
  
  return null; // No mapping found
}
```

---

## 📝 Mapping Examples by Source Type

### **1. PI System:**

```typescript
// Direct mapping
{
  sourceType: "PI",
  sourceIdentifier: "F1AbCdEfGhIjKlMnOpQrStUvWxYz",  // WebId
  sourcePath: "PI\\Plant1\\Line1\\Equipment1",
  targetType: "asset",
  targetId: "asset-101",
  tenantId: "tenant-456"
}

// Pattern mapping
{
  sourceType: "PI",
  isPattern: true,
  pattern: "PI\\\\Plant1\\\\Line1\\\\*",
  targetType: "unit",
  targetId: "unit-789",
  tenantId: "tenant-456"
}
```

---

### **2. OPC UA:**

```typescript
// Direct mapping
{
  sourceType: "OPCUA",
  sourceConnectionId: "opcua-conn-123",
  sourceIdentifier: "ns=2;s=Machine1.Temperature",
  targetType: "asset",
  targetId: "asset-101",
  tenantId: "tenant-456"
}

// Pattern mapping
{
  sourceType: "OPCUA",
  sourceConnectionId: "opcua-conn-123",
  isPattern: true,
  pattern: "ns=2;s=Machine1.*",
  targetType: "asset",
  targetId: "asset-101",
  tenantId: "tenant-456"
}
```

---

### **3. Modbus:**

```typescript
// Direct mapping
{
  sourceType: "Modbus",
  sourceConnectionId: "modbus-conn-456",
  sourceIdentifier: "40001",  // Register address
  targetType: "unit",
  targetId: "unit-789",
  tenantId: "tenant-456"
}

// Pattern mapping (register range)
{
  sourceType: "Modbus",
  sourceConnectionId: "modbus-conn-456",
  isPattern: true,
  pattern: "40001-40100",  // Register range
  targetType: "unit",
  targetId: "unit-789",
  tenantId: "tenant-456"
}
```

---

### **4. MQTT:**

```typescript
// Direct mapping
{
  sourceType: "MQTT",
  sourceConnectionId: "mqtt-conn-789",
  sourceIdentifier: "plant/unit1/sensor/temperature",
  targetType: "asset",
  targetId: "asset-101",
  tenantId: "tenant-456"
}

// Pattern mapping
{
  sourceType: "MQTT",
  sourceConnectionId: "mqtt-conn-789",
  isPattern: true,
  pattern: "plant/unit1/**",  // All topics under unit1
  targetType: "unit",
  targetId: "unit-789",
  tenantId: "tenant-456"
}
```

---

## 🔄 Event Tagging Flow

### **Complete Process:**

```typescript
async tagEventWithHierarchy(rawEvent: RawEvent): Promise<TaggedEvent> {
  // 1. Extract source information
  const sourceType = rawEvent.source;  // 'PI', 'OPCUA', etc.
  const sourceIdentifier = rawEvent.sourceIdentifier;
  const sourcePath = rawEvent.sourcePath;
  const connectionId = rawEvent.connectionId;
  const tenantId = rawEvent.tenantId;
  
  // 2. Find hierarchy mapping
  const hierarchyMapping = await this.hierarchyMappingService.findMapping({
    sourceType,
    sourceIdentifier,
    sourcePath,
    connectionId,
    tenantId,
  });
  
  // 3. Tag event
  return {
    ...rawEvent,
    tenantId: hierarchyMapping?.tenantId || tenantId,
    unitId: hierarchyMapping?.unitId,
    assetId: hierarchyMapping?.assetId,
    organizationId: hierarchyMapping?.organizationId,
  };
}
```

---

## 🎯 Mapping Configuration UI

### **User Workflow:**

1. **Connect to Source:**
   - User creates connection (PI, OPC UA, Modbus, etc.)
   - System discovers available identifiers (elements, nodes, topics, registers)

2. **Create Mappings:**
   - **Option A: Individual Mapping**
     - Select source identifier (e.g., PI element, OPC UA node)
     - Select target hierarchy level (Unit or Asset)
     - Select specific Unit/Asset
     - Save mapping
   
   - **Option B: Bulk Pattern Mapping**
     - Define pattern (e.g., "PI\\Plant1\\Line1\\*")
     - Select target Unit/Asset
     - System applies to all matching identifiers
     - Save pattern rule

3. **Manage Mappings:**
   - View all mappings
   - Edit/Delete mappings
   - Test mappings
   - Import/Export mappings

---

## 🔧 Implementation Architecture

### **Backend Services:**

1. **HierarchyMappingService:**
   - CRUD operations for mappings
   - Mapping lookup (priority-based)
   - Pattern matching
   - Bulk operations

2. **EventTaggingService:**
   - Tags events with hierarchy IDs
   - Uses HierarchyMappingService
   - Bulk tagging for performance

3. **MappingDiscoveryService:**
   - Discovers available identifiers from sources
   - Suggests potential mappings
   - Validates mappings

---

## 📋 Database Schema

### **Universal Mapping Table:**

```typescript
@Entity('source_hierarchy_mappings')
export class SourceHierarchyMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Source
  @Column({ name: 'source_type', type: 'varchar', length: 50 })
  sourceType: 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | 'Database' | 'RESTAPI';

  @Column({ name: 'source_connection_id', type: 'uuid', nullable: true })
  sourceConnectionId?: string;

  @Column({ name: 'source_identifier', type: 'nvarchar', length: 1000 })
  sourceIdentifier: string;

  @Column({ name: 'source_path', type: 'nvarchar', length: 1000, nullable: true })
  sourcePath?: string;

  // Target
  @Column({ name: 'target_type', type: 'varchar', length: 50 })
  targetType: 'unit' | 'asset' | 'tenant';

  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  // Context
  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  // Pattern
  @Column({ name: 'is_pattern', type: 'bit', default: false })
  isPattern: boolean;

  @Column({ name: 'pattern', type: 'nvarchar', length: 500, nullable: true })
  pattern?: string;

  @Column({ name: 'priority', type: 'int', default: 50 })
  priority: number;

  // Metadata
  @Column({ name: 'is_active', type: 'bit', default: true })
  isActive: boolean;

  @Column({ name: 'description', type: 'nvarchar', length: 'MAX', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
```

---

## 🚀 Migration Strategy

### **Phase 1: Create Universal System**

1. Create `SourceHierarchyMapping` entity
2. Create `HierarchyMappingService`
3. Create API endpoints
4. Migrate existing AF Bindings to new system

### **Phase 2: Update Event Tagging**

1. Update event pull services to use new mapping system
2. Update bulk tagging service
3. Add pattern matching support

### **Phase 3: Frontend Integration**

1. Create mapping configuration UI
2. Support all source types
3. Pattern rule editor
4. Bulk mapping tools

---

## ✅ Benefits

1. **Universal:** Works for ALL sources
2. **Flexible:** Direct mappings + patterns
3. **Scalable:** Pattern rules for bulk mapping
4. **Maintainable:** Single system for all mappings
5. **Extensible:** Easy to add new source types

---

## 🎯 Key Features

1. **Direct Mappings:** One-to-one mapping
2. **Pattern Rules:** One pattern → many events
3. **Path Parsing:** Extract hierarchy from source paths
4. **Connection Defaults:** Default mapping per connection
5. **Priority System:** Control mapping order
6. **Bulk Operations:** Create/edit many mappings at once

---

**Status:** 📋 Design Document Ready for Implementation

