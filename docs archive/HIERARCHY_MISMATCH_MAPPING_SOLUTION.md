# 🔀 Hierarchy Mismatch Mapping - Flexible Solution

## 📋 The Challenge

**Problem:** External source hierarchies don't match ProAct's internal hierarchy!

### **Internal ProAct Hierarchy (4 levels):**
```
Organization
    ↓
Tenant (Plant)
    ↓
Unit (Production Line/Machine)
    ↓
Asset (Equipment/Component)
```

### **External Source Hierarchies (Different structures):**

**1. PI System:**
```
PI Database
    ↓
Element (e.g., "Plant1")
    ↓
Sub-Element (e.g., "Line1")
    ↓
Equipment Element (e.g., "Machine1")
    ↓
Attributes (e.g., "Temperature", "Pressure")
```
- ❌ Different structure
- ❌ Different levels (could be 2-5 levels)
- ❌ Different naming

**2. OPC UA:**
```
Server
    ↓
Namespace/Object (e.g., "ns=2;s=Plant1")
    ↓
Object/Component (e.g., "ns=2;s=Line1")
    ↓
Variable (e.g., "ns=2;s=Temperature")
```
- ❌ Flat NodeId structure
- ❌ Different organization

**3. Modbus:**
```
Connection
    ↓
Register Address (e.g., "40001", "40002")
```
- ❌ Only 2 levels (flat)
- ❌ No hierarchy structure

**4. MQTT:**
```
Topic Structure (flexible):
  "org/acme/plant/plant-a/line/line-1/machine/machine-1/temp"
  OR
  "plant-a/line-1/sensor/temp"
  OR
  "factory1/equipment/temperature"
```
- ❌ Completely flexible structure
- ❌ Could be 2-10 levels
- ❌ User-defined naming

**5. Database:**
```
Database
    ↓
Table
    ↓
Row (with columns)
```
- ❌ Flat relational structure
- ❌ No hierarchy

---

## 🎯 Solution: Flexible Mapping Strategies

### **Strategy 1: Level Mapping Configuration**

**Concept:** Configure which external level maps to which internal level

**Mapping Configuration:**
```typescript
HierarchyLevelMapping {
  sourceType: "PI"
  sourceLevel: 1  // Top level in PI
  targetLevel: "organization"  // Maps to ProAct Organization
  
  sourceLevel: 2  // Second level in PI
  targetLevel: "tenant"  // Maps to ProAct Tenant
  
  sourceLevel: 3  // Third level in PI
  targetLevel: "unit"  // Maps to ProAct Unit
  
  sourceLevel: 4  // Fourth level in PI
  targetLevel: "asset"  // Maps to ProAct Asset
}
```

**Example:**
```
PI Path: "PI\\Acme Corp\\Plant A\\Line 1\\Machine 1"
         [Level 0] [Level 1]   [Level 2] [Level 3] [Level 4]

Mapping Config:
  Level 1 ("Acme Corp") → Organization
  Level 2 ("Plant A") → Tenant
  Level 3 ("Line 1") → Unit
  Level 4 ("Machine 1") → Asset
```

---

### **Strategy 2: Named Path Segment Mapping**

**Concept:** Map by path segment name/pattern, not position

**Mapping Rules:**
```typescript
PathSegmentMapping {
  sourceType: "PI"
  segmentPattern: "Organization:*"  // Matches any segment named "Organization"
  targetLevel: "organization"
  
  segmentPattern: "Plant:*"  // Matches segments starting with "Plant"
  targetLevel: "tenant"
  
  segmentPattern: "Line:*"  // Matches segments starting with "Line"
  targetLevel: "unit"
  
  segmentPattern: "Machine:*"  // Matches segments starting with "Machine"
  targetLevel: "asset"
}
```

**Example:**
```
PI Path: "PI\\Plant A\\Equipment\\Line 1\\Machine 1"
         [Level 0] [Plant]  [Other]  [Line]  [Machine]

Mapping Result:
  "Plant A" (matches "Plant:*") → Tenant
  "Line 1" (matches "Line:*") → Unit
  "Machine 1" (matches "Machine:*") → Asset
  "Equipment" (no match) → Ignored
```

---

### **Strategy 3: Flexible Path Template**

**Concept:** Define template patterns that extract hierarchy from paths

**Template Examples:**

**Template 1: PI Path Pattern**
```
Template: "{organization}\\{tenant}\\{unit}\\{asset}"
Path: "Acme Corp\\Plant A\\Line 1\\Machine 1"
Result:
  organization = "Acme Corp"
  tenant = "Plant A"
  unit = "Line 1"
  asset = "Machine 1"
```

**Template 2: MQTT Topic Pattern**
```
Template: "{org}/org/{organization}/plant/{tenant}/unit/{unit}/asset/{asset}/data"
Topic: "acme/org/AcmeCorp/plant/PlantA/unit/Line1/asset/Machine1/data"
Result:
  organization = "AcmeCorp"
  tenant = "PlantA"
  unit = "Line1"
  asset = "Machine1"
```

**Template 3: OPC UA NodeId Path**
```
Template: "ns={ns};s={tenant}.{unit}.{asset}"
NodeId: "ns=2;s=PlantA.Line1.Machine1"
Result:
  tenant = "PlantA"
  unit = "Line1"
  asset = "Machine1"
```

---

### **Strategy 4: Multi-Level Collapse/Expand**

**Concept:** Handle cases where external has more or fewer levels

**Scenario A: External has MORE levels**
```
PI Path: "PI\\Acme\\Plant A\\Area 1\\Line 1\\Station 1\\Machine 1"
         [6 levels] vs Internal [4 levels]

Solution: Collapse intermediate levels
  Level 1 ("Acme") → Organization
  Level 2 ("Plant A") → Tenant
  Levels 3-4 ("Area 1\\Line 1") → Unit (combine)
  Levels 5-6 ("Station 1\\Machine 1") → Asset (combine)
```

**Scenario B: External has FEWER levels**
```
Modbus: "Connection1:40001"
        [2 levels] vs Internal [4 levels]

Solution: Use defaults/fill missing
  Connection → Tenant (default or configured)
  Register → Unit (default or configured)
  Asset → Not specified (null)
```

**Scenario C: External is FLAT (no hierarchy)**
```
Database Table Row:
  table: "events"
  row_id: "12345"
  [No hierarchy]

Solution: Connection-level defaults
  All rows from this connection → Tenant (default)
  All rows from this table → Unit (default)
  Row ID → Asset (if configured)
```

---

### **Strategy 5: Lookup-Based Mapping**

**Concept:** Use lookup tables to map external names to internal IDs

**Lookup Table:**
```typescript
ExternalNameMapping {
  sourceType: "PI"
  externalName: "Plant A"  // From PI path
  targetType: "tenant"
  targetId: "tenant-456"  // Internal Tenant ID
  targetName: "Plant A"  // Match by name
  
  externalName: "Line 1"
  targetType: "unit"
  targetId: "unit-789"
  targetName: "Production Line 1"  // Different name!
}
```

**Flow:**
```
1. Parse external path: "PI\\Plant A\\Line 1"
2. Extract names: ["Plant A", "Line 1"]
3. Lookup in mapping table:
   - "Plant A" → tenant-456 ✅
   - "Line 1" → unit-789 ✅
4. Tag event with found IDs
```

---

### **Strategy 6: Hierarchical Path Parsing with Fallbacks**

**Concept:** Try multiple parsing strategies with fallback

**Multi-Stage Parsing:**
```typescript
async parseHierarchy(sourcePath: string, sourceType: string): Promise<HierarchyIds> {
  // Stage 1: Try template pattern matching
  const templateMatch = await tryTemplatePattern(sourcePath);
  if (templateMatch) return templateMatch;
  
  // Stage 2: Try named segment mapping
  const segmentMatch = await trySegmentMapping(sourcePath);
  if (segmentMatch) return segmentMatch;
  
  // Stage 3: Try level-based mapping
  const levelMatch = await tryLevelMapping(sourcePath);
  if (levelMatch) return levelMatch;
  
  // Stage 4: Try lookup table
  const lookupMatch = await tryLookupMapping(sourcePath);
  if (lookupMatch) return lookupMatch;
  
  // Stage 5: Fallback to defaults
  return getConnectionDefaults();
}
```

---

## 📊 Real-World Examples

### **Example 1: PI with 5 Levels → ProAct 4 Levels**

**PI Structure:**
```
PI\\Acme Corp\\Plant A\\Area 1\\Line 1\\Machine 1
[Level 0] [Level 1]  [Level 2] [Level 3] [Level 4] [Level 5]
```

**Mapping Configuration:**
```json
{
  "sourceType": "PI",
  "levelMappings": [
    { "sourceLevel": 1, "targetLevel": "organization", "extract": true },
    { "sourceLevel": 2, "targetLevel": "tenant", "extract": true },
    { "sourceLevel": 4, "targetLevel": "unit", "extract": true },  // Skip level 3
    { "sourceLevel": 5, "targetLevel": "asset", "extract": true }
  ]
}
```

**Result:**
- Organization: "Acme Corp" (from level 1)
- Tenant: "Plant A" (from level 2)
- Unit: "Line 1" (from level 4, skipped level 3)
- Asset: "Machine 1" (from level 5)

---

### **Example 2: MQTT with Flexible Structure**

**MQTT Topics:**
```
"factory/plant-a/line-1/sensor/temp"
"org/acme/plant/plant-a/unit/line-1/asset/machine-1/data"
"plant-a.equipment.line-1.machine-1.temperature"
```

**Template Patterns:**
```json
{
  "patterns": [
    {
      "pattern": "{tenant}/{unit}/sensor/{sensor}",
      "example": "factory/plant-a/line-1/sensor/temp",
      "mapping": {
        "tenant": "level[1]",
        "unit": "level[2]"
      }
    },
    {
      "pattern": "org/{org}/plant/{tenant}/unit/{unit}/asset/{asset}/data",
      "example": "org/acme/plant/plant-a/unit/line-1/asset/machine-1/data",
      "mapping": {
        "organization": "org",
        "tenant": "tenant",
        "unit": "unit",
        "asset": "asset"
      }
    },
    {
      "pattern": "{tenant}.{category}.{unit}.{asset}.{parameter}",
      "example": "plant-a.equipment.line-1.machine-1.temperature",
      "mapping": {
        "tenant": "tenant",
        "unit": "unit",
        "asset": "asset"
      }
    }
  ]
}
```

---

### **Example 3: Modbus (Flat Structure)**

**Modbus Structure:**
```
Connection: "modbus-conn-123"
Register: "40001"
[No hierarchy - flat structure]
```

**Connection-Level Defaults:**
```json
{
  "connectionId": "modbus-conn-123",
  "defaults": {
    "tenantId": "tenant-456",  // All events from this connection
    "unitId": "unit-789"        // All events from this connection
  },
  "registerMappings": [
    {
      "registerRange": "40001-40100",
      "unitId": "unit-789"
    },
    {
      "registerRange": "40101-40200",
      "unitId": "unit-790"
    }
  ]
}
```

**Result:**
- Register 40050 → unit-789 (from range mapping)
- Register 40150 → unit-790 (from range mapping)
- Default → tenant-456, unit-789 (from connection defaults)

---

### **Example 4: OPC UA (Namespace-Based)**

**OPC UA Structure:**
```
Server: "opc.tcp://server:4840"
NodeId: "ns=2;s=PlantA.Line1.Machine1.Temperature"
[Flat structure in NodeId string]
```

**Parsing Strategy:**
```typescript
// Parse NodeId string
const nodeId = "ns=2;s=PlantA.Line1.Machine1.Temperature";

// Extract segments after "s="
const segments = nodeId.split("s=")[1].split(".");

// Mapping configuration
const mapping = {
  segments: ["tenant", "unit", "asset", "parameter"],
  skipLast: true  // Skip "Temperature" (parameter, not hierarchy)
};

// Result
tenant = segments[0] = "PlantA"
unit = segments[1] = "Line1"
asset = segments[2] = "Machine1"
```

---

## 🔧 Comprehensive Mapping Configuration

### **Mapping Configuration Entity:**

```typescript
interface HierarchyMappingConfig {
  id: string;
  sourceType: 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | 'Database' | 'RESTAPI';
  sourceConnectionId?: string;
  
  // Strategy selection
  mappingStrategy: 'template' | 'level-based' | 'segment-based' | 'lookup' | 'defaults';
  
  // Template-based (for flexible paths)
  pathTemplate?: string;  // "{tenant}/{unit}/{asset}"
  templateMapping?: {
    tenant: string;  // Segment name or regex group
    unit: string;
    asset: string;
    organization?: string;
  };
  
  // Level-based (for fixed structure)
  levelMapping?: Array<{
    sourceLevel: number;  // 0-based or 1-based
    targetLevel: 'organization' | 'tenant' | 'unit' | 'asset';
    extract: boolean;
    transform?: (value: string) => string;  // Optional transformation
  }>;
  
  // Segment-based (for named segments)
  segmentMappings?: Array<{
    pattern: string;  // Regex or prefix
    targetLevel: 'organization' | 'tenant' | 'unit' | 'asset';
    extractFromSegment: number;  // Which segment index
  }>;
  
  // Lookup-based
  lookupTable?: Array<{
    externalName: string;
    targetType: 'organization' | 'tenant' | 'unit' | 'asset';
    targetId: string;
    caseSensitive?: boolean;
  }>;
  
  // Defaults (fallback)
  defaults?: {
    tenantId?: string;
    unitId?: string;
    assetId?: string;
    organizationId?: string;
  };
  
  // Context
  tenantId: string;
  priority: number;
  isActive: boolean;
}
```

---

## 🎯 Unified Mapping Algorithm

### **Complete Mapping Flow:**

```typescript
async mapToHierarchy(
  sourceType: string,
  sourceIdentifier: string,
  sourcePath?: string,
  connectionId?: string,
  tenantId: string
): Promise<HierarchyIds | null> {
  
  // 1. Load mapping configurations for this source type
  const configs = await this.getMappingConfigs(sourceType, tenantId);
  
  // 2. Sort by priority (higher first)
  configs.sort((a, b) => b.priority - a.priority);
  
  // 3. Try each configuration
  for (const config of configs) {
    if (!config.isActive) continue;
    
    let result: HierarchyIds | null = null;
    
    // Try strategy based on config
    switch (config.mappingStrategy) {
      case 'template':
        result = await this.tryTemplateMapping(sourcePath, config);
        break;
        
      case 'level-based':
        result = await this.tryLevelMapping(sourcePath, config);
        break;
        
      case 'segment-based':
        result = await this.trySegmentMapping(sourcePath, config);
        break;
        
      case 'lookup':
        result = await this.tryLookupMapping(sourcePath, config);
        break;
        
      case 'defaults':
        result = config.defaults || null;
        break;
    }
    
    // If successful, return result
    if (result && this.isValid(result)) {
      return result;
    }
  }
  
  // 4. No mapping found - return null or connection defaults
  return await this.getConnectionDefaults(connectionId) || null;
}
```

---

## 📋 Template-Based Mapping Examples

### **Template Pattern Syntax:**

```
Template: "{organization}/{tenant}/{unit}/{asset}"

Path: "Acme/PlantA/Line1/Machine1"
Result:
  organization = "Acme"
  tenant = "PlantA"
  unit = "Line1"
  asset = "Machine1"

---

Template: "{tenant}/**/{unit}/**/{asset}"

Path: "PlantA/area/zone/Line1/stations/Machine1"
Result:
  tenant = "PlantA"
  unit = "Line1"  // Found after "area/zone/"
  asset = "Machine1"  // Found after "stations/"

---

Template: "{tenant}.{category}.{unit}.{asset}"

Path: "PlantA.equipment.Line1.Machine1"
Result:
  tenant = "PlantA"
  unit = "Line1"
  asset = "Machine1"
  (category "equipment" ignored - not in hierarchy)
```

---

## 🔍 Level-Based Mapping with Skip/Collapse

### **Advanced Level Mapping:**

```typescript
interface LevelMappingRule {
  sourceLevels: number[];  // Multiple levels can map to one target
  targetLevel: 'organization' | 'tenant' | 'unit' | 'asset';
  combineStrategy: 'first' | 'last' | 'join' | 'lookup';
  separator?: string;  // For join strategy
  transform?: (value: string[]) => string;  // Custom transformation
}
```

**Example:**
```json
{
  "sourceType": "PI",
  "levelMappings": [
    {
      "sourceLevels": [1],
      "targetLevel": "organization",
      "combineStrategy": "first"
    },
    {
      "sourceLevels": [2],
      "targetLevel": "tenant",
      "combineStrategy": "first"
    },
    {
      "sourceLevels": [3, 4],  // Combine levels 3 and 4
      "targetLevel": "unit",
      "combineStrategy": "join",
      "separator": " - "
    },
    {
      "sourceLevels": [5, 6],  // Combine levels 5 and 6
      "targetLevel": "asset",
      "combineStrategy": "join",
      "separator": " - "
    }
  ]
}
```

**Result:**
```
Path: "PI\\Acme\\Plant A\\Area 1\\Line 1\\Station 1\\Machine 1"

Mapping:
  Organization = "Acme" (level 1)
  Tenant = "Plant A" (level 2)
  Unit = "Area 1 - Line 1" (levels 3+4 joined)
  Asset = "Station 1 - Machine 1" (levels 5+6 joined)
```

---

## 🎨 Flexible Path Parsing

### **Parsing Strategies:**

**1. Delimiter-Based:**
```
Path: "Acme/PlantA/Line1/Machine1"
Delimiter: "/"
Parse: Split by delimiter, map segments
```

**2. Regex-Based:**
```
Path: "PI\\Acme Corp\\Plant A\\Line 1"
Pattern: /^PI\\(.+?)\\(.+?)\\(.+?)$/
Groups: [1] = Organization, [2] = Tenant, [3] = Unit
```

**3. Named Segment:**
```
Path: "org=Acme,plant=PlantA,line=Line1"
Parse: Extract key-value pairs
```

**4. Hierarchical JSON:**
```
Path: {
  "organization": "Acme",
  "tenant": "PlantA",
  "unit": "Line1",
  "asset": "Machine1"
}
Parse: Direct property access
```

---

## 🔄 Handling Missing Levels

### **Scenario: External has fewer levels than internal**

**Options:**

1. **Use Defaults:**
   ```
   Modbus: "Connection1:40001" (2 levels)
   Internal: 4 levels needed
   
   Solution:
     Tenant → Connection default
     Unit → Register mapping
     Asset → null (not available)
   ```

2. **Infer from Context:**
   ```
   OPC UA: "ns=2;s=Machine1" (1 level)
   
   Solution:
     Tenant → From connection config
     Unit → Infer from asset's parent unit
     Asset → From NodeId
   ```

3. **Multi-Mapping:**
   ```
   Single external identifier maps to multiple internal levels
   
   Example:
     "PlantA" → Tenant ID
     Also → Default Unit for this tenant
   ```

---

## ✅ Recommended Solution: Hybrid Approach

### **Multi-Strategy Mapping System:**

1. **Primary: Template/Pattern Matching**
   - Define path templates
   - Extract hierarchy from paths
   - Most flexible

2. **Secondary: Level-Based Mapping**
   - Map by position/level
   - Handle fixed structures

3. **Tertiary: Segment Name Matching**
   - Match by segment name/pattern
   - Handle named hierarchies

4. **Fallback: Lookup Table**
   - Name-to-ID mapping
   - Handle naming differences

5. **Last Resort: Connection Defaults**
   - Default hierarchy for connection
   - Always works, least precise

---

## 🎯 Configuration Examples

### **Example 1: PI with Flexible Structure**

```json
{
  "sourceType": "PI",
  "mappingStrategy": "template",
  "pathTemplate": "{organization}\\{tenant}\\{unit}\\{asset}",
  "templateMapping": {
    "organization": "segment[1]",
    "tenant": "segment[2]",
    "unit": "segment[3]",
    "asset": "segment[4]"
  },
  "fallback": {
    "levelMapping": [
      { "sourceLevel": 1, "targetLevel": "organization" },
      { "sourceLevel": 2, "targetLevel": "tenant" },
      { "sourceLevel": 3, "targetLevel": "unit" },
      { "sourceLevel": 4, "targetLevel": "asset" }
    ]
  }
}
```

---

### **Example 2: OPC UA with NodeId Parsing**

```json
{
  "sourceType": "OPCUA",
  "mappingStrategy": "template",
  "pathTemplate": "ns={ns};s={tenant}.{unit}.{asset}",
  "templateMapping": {
    "tenant": "extract('s=([^.]+)')",
    "unit": "extract('s=[^.]+\\.([^.]+)')",
    "asset": "extract('s=[^.]+\\.([^.]+)\\.([^.]+)')"
  }
}
```

---

### **Example 3: MQTT with Multiple Patterns**

```json
{
  "sourceType": "MQTT",
  "mappingStrategy": "template",
  "patterns": [
    {
      "pattern": "{tenant}/{unit}/sensor/{sensor}",
      "mapping": {
        "tenant": "segment[0]",
        "unit": "segment[1]"
      }
    },
    {
      "pattern": "org/{org}/plant/{tenant}/unit/{unit}/asset/{asset}",
      "mapping": {
        "organization": "named('org')",
        "tenant": "named('tenant')",
        "unit": "named('unit')",
        "asset": "named('asset')"
      }
    }
  ]
}
```

---

## 🔧 Implementation Architecture

### **Hierarchy Mapping Service:**

```typescript
@Injectable()
export class HierarchyMappingService {
  
  /**
   * Map external path to internal hierarchy
   */
  async mapToHierarchy(request: MappingRequest): Promise<HierarchyIds> {
    // 1. Get all applicable mapping configs
    const configs = await this.getConfigs(request);
    
    // 2. Try each config in priority order
    for (const config of configs) {
      const result = await this.tryMapping(request, config);
      if (result) return result;
    }
    
    // 3. Return defaults or null
    return this.getDefaults(request) || null;
  }
  
  /**
   * Try template-based mapping
   */
  private async tryTemplateMapping(
    sourcePath: string,
    config: MappingConfig
  ): Promise<HierarchyIds | null> {
    // Parse template and extract values
    // Return hierarchy IDs
  }
  
  /**
   * Try level-based mapping
   */
  private async tryLevelMapping(
    sourcePath: string,
    config: MappingConfig
  ): Promise<HierarchyIds | null> {
    // Split path into levels
    // Map levels to hierarchy
    // Return hierarchy IDs
  }
  
  /**
   * Try segment-based mapping
   */
  private async trySegmentMapping(
    sourcePath: string,
    config: MappingConfig
  ): Promise<HierarchyIds | null> {
    // Parse segments
    // Match patterns
    // Return hierarchy IDs
  }
}
```

---

## ✅ Solution Summary

### **Key Strategies:**

1. **Template Patterns** - Flexible path parsing
2. **Level Mapping** - Position-based mapping
3. **Segment Matching** - Name-based matching
4. **Lookup Tables** - Name-to-ID mapping
5. **Defaults** - Fallback values

### **Handles:**

- ✅ Different number of levels
- ✅ Different structures
- ✅ Different naming conventions
- ✅ Missing levels (defaults)
- ✅ Extra levels (collapse/combine)
- ✅ Flat structures (connection defaults)

---

**Status:** 📋 Complete Solution Design - Ready for Implementation

