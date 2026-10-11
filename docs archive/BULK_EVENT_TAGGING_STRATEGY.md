# 🚀 Bulk Event Tagging Strategy - Performance & Scalability

## 📋 The Challenge

**Problem:** When pulling thousands or millions of events from external sources, tagging them one-by-one is:
- ❌ Too slow (performance bottleneck)
- ❌ Inefficient (redundant database lookups)
- ❌ Not scalable (can't handle high-volume streams)

**Question:** How to efficiently tag bulk events with hierarchy identifiers?

---

## 🎯 Current Approach (One-by-One)

### **Problematic Flow:**
```typescript
for (const event of events) {  // ❌ Sequential processing
  const binding = await findBinding(event.sourceId);  // ❌ DB query per event
  if (binding) {
    event.unitId = binding.localId;
  }
  await saveEvent(event);  // ❌ Save one at a time
}
```

**Issues:**
- N database queries for N events
- Sequential processing
- Slow for large batches

**Example:**
- 10,000 events × 10ms per lookup = **100 seconds** ❌

---

## ✅ Solution Strategies

### **Strategy 1: Batch Binding Lookup** ⭐ **Recommended**

**Concept:** Load all bindings once, create lookup map, use for all events

**Flow:**
```typescript
// 1. Load ALL bindings for tenant once
const bindings = await bindingService.getBindingsByTenant(tenantId);
const bindingMap = new Map(bindings.map(b => [b.sourceId, b]));

// 2. Process events in bulk with in-memory map
const taggedEvents = events.map(event => {
  const binding = bindingMap.get(event.sourceId);
  return {
    ...event,
    unitId: binding?.boundType === 'unit' ? binding.localId : undefined,
    assetId: binding?.boundType === 'asset' ? binding.localId : undefined,
  };
});

// 3. Bulk insert into database
await eventRepository.save(taggedEvents);  // ✅ Bulk insert
```

**Performance:**
- 1 database query for bindings
- O(1) lookup per event (in-memory map)
- Bulk database insert
- 10,000 events: **~2-5 seconds** ✅

---

### **Strategy 2: Pattern-Based Rules** ⭐ **For High Volume**

**Concept:** Define patterns/rules instead of individual bindings

**Pattern Examples:**

1. **Path-Based Pattern:**
   ```
   Pattern: "PI\\Plant1\\*\\Unit*"
   Rule: Extract "Unit" ID from path → unitId
   ```

2. **Hierarchical Pattern:**
   ```
   Pattern: "PI\\{Organization}\\{Tenant}\\{Unit}\\*"
   Rule: Parse path to extract hierarchy → Set unitId, tenantId
   ```

3. **Topic-Based Pattern (MQTT):**
   ```
   Pattern: "plant/{tenantId}/unit/{unitId}/events"
   Rule: Extract tenantId and unitId from topic
   ```

4. **Register-Based Pattern (Modbus):**
   ```
   Pattern: "Connection1:Registers:1000-1999"
   Rule: Map register range → unitId
   ```

**Flow:**
```typescript
// 1. Load pattern rules
const rules = await patternService.getPatterns(tenantId);

// 2. Apply patterns to events in bulk
const taggedEvents = events.map(event => {
  // Try each pattern rule
  for (const rule of rules) {
    if (matchesPattern(event.sourceId, rule.pattern)) {
      const hierarchyIds = extractHierarchy(event.sourceId, rule);
      return { ...event, ...hierarchyIds };
    }
  }
  return event; // No match
});

// 3. Bulk insert
await eventRepository.save(taggedEvents);
```

**Benefits:**
- One pattern can match thousands of events
- No individual bindings needed
- Very fast pattern matching

---

### **Strategy 3: Lazy Tagging** (Query-Time Tagging)

**Concept:** Store events with source identifiers, tag when querying

**Flow:**
```typescript
// 1. Store events with source identifiers only
await eventRepository.save(events.map(e => ({
  ...e,
  sourceId: e.webId,  // Store original identifier
  // No unitId/assetId yet
})));

// 2. Tag during query based on current bindings
async getEvents(filters: { tenantId, unitId, assetId }) {
  // Load current bindings
  const bindings = await getBindings(filters.tenantId);
  const bindingMap = new Map(...);
  
  // Load events
  const events = await eventRepository.find(filters);
  
  // Tag on-the-fly
  return events.map(event => {
    const binding = bindingMap.get(event.sourceId);
    return {
      ...event,
      unitId: binding?.boundType === 'unit' ? binding.localId : null,
      assetId: binding?.boundType === 'asset' ? binding.localId : null,
    };
  });
}
```

**Benefits:**
- Events stored immediately (no tagging delay)
- Binding changes retroactively apply
- Flexible for changing bindings

**Drawbacks:**
- Query-time overhead
- Can't filter by unitId at database level

---

### **Strategy 4: Stream Processing with Batching**

**Concept:** Process events in streams/chunks, tag in batches

**Flow:**
```typescript
// Process events in chunks
async function processEventStream(source: EventStream, tenantId: string) {
  // Load bindings once
  const bindingMap = await loadBindingMap(tenantId);
  
  const BATCH_SIZE = 1000;
  let batch: Event[] = [];
  
  for await (const event of source) {
    // Tag immediately (in-memory)
    const tagged = tagEvent(event, bindingMap);
    batch.push(tagged);
    
    // Process batch when full
    if (batch.length >= BATCH_SIZE) {
      await eventRepository.save(batch);  // Bulk insert
      batch = [];
    }
  }
  
  // Process remaining
  if (batch.length > 0) {
    await eventRepository.save(batch);
  }
}

function tagEvent(event: Event, bindingMap: Map<string, Binding>): Event {
  const binding = bindingMap.get(event.sourceId);
  return {
    ...event,
    unitId: binding?.boundType === 'unit' ? binding.localId : undefined,
    assetId: binding?.boundType === 'asset' ? binding.localId : undefined,
  };
}
```

**Benefits:**
- Memory efficient (processes in chunks)
- Fast (bulk inserts)
- Handles streams of any size

---

### **Strategy 5: Hierarchical Default Rules**

**Concept:** Use hierarchy defaults when bindings don't exist

**Flow:**
```typescript
// Hierarchy defaults
const defaults = {
  'PI\\Plant1\\*': { tenantId: 'plant-1', organizationId: 'org-1' },
  'PI\\Plant1\\Line1\\*': { unitId: 'line-1', tenantId: 'plant-1' },
  'OPCUA\\Machine1\\*': { assetId: 'machine-1', unitId: 'line-1' },
};

// Tag events with defaults
const taggedEvents = events.map(event => {
  // Try binding first
  const binding = bindingMap.get(event.sourceId);
  if (binding) {
    return applyBinding(event, binding);
  }
  
  // Fall back to pattern defaults
  for (const [pattern, defaults] of Object.entries(hierarchyDefaults)) {
    if (matchesPattern(event.sourceId, pattern)) {
      return { ...event, ...defaults };
    }
  }
  
  return event; // No match
});
```

**Benefits:**
- Handles events without explicit bindings
- Fast pattern matching
- Configurable defaults

---

## 🏆 Recommended Approach: Hybrid Strategy

### **Best Practice: Combine Multiple Strategies**

**1. For Bulk Pulls (Initial Sync):**
- ✅ Use **Batch Binding Lookup** + **Pattern Rules**
- Load bindings once
- Load pattern rules
- Process in batches of 1000-5000
- Bulk insert

**2. For Real-Time Streams:**
- ✅ Use **Stream Processing with Batching**
- Load bindings once (cache)
- Process events in chunks
- Bulk insert periodically

**3. For Missing Bindings:**
- ✅ Use **Hierarchical Default Rules**
- Pattern-based defaults
- Configurable fallbacks

**4. For Querying:**
- ✅ Store events with tags (for filtering)
- Use lazy tagging only for untagged legacy events

---

## 📊 Performance Comparison

### **Scenario: 10,000 Events**

| Strategy | DB Queries | Processing Time | Scalability |
|----------|------------|----------------|-------------|
| **One-by-One** | 10,000+ | ~100 seconds | ❌ Poor |
| **Batch Lookup** | 1 + 1 bulk insert | ~2-5 seconds | ✅ Good |
| **Pattern Rules** | 1 + 1 bulk insert | ~1-3 seconds | ✅ Excellent |
| **Lazy Tagging** | 1 per query | Query-time only | ⚠️ Moderate |
| **Stream Batching** | 10 (1k chunks) | ~5-10 seconds | ✅ Excellent |

---

## 🔧 Implementation Example

### **Optimal Bulk Tagging Service:**

```typescript
@Injectable()
export class BulkEventTaggingService {
  private bindingCache: Map<string, Map<string, Binding>> = new Map();
  private patternCache: Map<string, PatternRule[]> = new Map();

  /**
   * Tag multiple events efficiently
   */
  async tagEvents(events: RawEvent[], tenantId: string): Promise<TaggedEvent[]> {
    // 1. Load/cache bindings
    const bindingMap = await this.getBindingMap(tenantId);
    
    // 2. Load/cache pattern rules
    const patternRules = await this.getPatternRules(tenantId);
    
    // 3. Tag events in bulk (all in memory)
    return events.map(event => this.tagSingleEvent(event, bindingMap, patternRules));
  }

  private async getBindingMap(tenantId: string): Promise<Map<string, Binding>> {
    // Check cache
    if (this.bindingCache.has(tenantId)) {
      return this.bindingCache.get(tenantId)!;
    }
    
    // Load from database (once)
    const bindings = await this.bindingService.findAll({ tenantId });
    const map = new Map(bindings.map(b => [b.sourceId, b]));
    
    // Cache for future use
    this.bindingCache.set(tenantId, map);
    return map;
  }

  private async getPatternRules(tenantId: string): Promise<PatternRule[]> {
    // Check cache
    if (this.patternCache.has(tenantId)) {
      return this.patternCache.get(tenantId)!;
    }
    
    // Load patterns
    const rules = await this.patternService.findAll({ tenantId });
    this.patternCache.set(tenantId, rules);
    return rules;
  }

  private tagSingleEvent(
    event: RawEvent,
    bindingMap: Map<string, Binding>,
    patternRules: PatternRule[]
  ): TaggedEvent {
    // Try explicit binding first
    const binding = bindingMap.get(event.sourceId);
    if (binding) {
      return {
        ...event,
        unitId: binding.boundType === 'unit' ? binding.localId : undefined,
        assetId: binding.boundType === 'asset' ? binding.localId : undefined,
        tenantId: binding.tenantId,
      };
    }
    
    // Try pattern rules
    for (const rule of patternRules) {
      if (this.matchesPattern(event.sourceId, rule.pattern)) {
        const hierarchyIds = this.extractHierarchy(event.sourceId, rule);
        return { ...event, ...hierarchyIds };
      }
    }
    
    // No match - return untagged (can be tagged later)
    return event;
  }

  private matchesPattern(sourceId: string, pattern: string): boolean {
    // Convert pattern to regex
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(sourceId);
  }

  private extractHierarchy(sourceId: string, rule: PatternRule): HierarchyIds {
    // Extract hierarchy from sourceId using rule
    // Example: "PI\\Plant1\\Line1\\Equipment" with pattern "PI\\{tenant}\\{unit}\\*"
    // Extract: tenantId="Plant1", unitId="Line1"
    
    const matches = sourceId.match(rule.extractionRegex);
    return {
      tenantId: matches?.[rule.tenantGroup] || undefined,
      unitId: matches?.[rule.unitGroup] || undefined,
      assetId: matches?.[rule.assetGroup] || undefined,
    };
  }

  /**
   * Clear cache when bindings/patterns change
   */
  invalidateCache(tenantId: string) {
    this.bindingCache.delete(tenantId);
    this.patternCache.delete(tenantId);
  }
}
```

---

## 🎯 Pattern Rule Configuration

### **Pattern Rule Structure:**

```typescript
interface PatternRule {
  id: string;
  tenantId: string;
  name: string;
  sourceType: 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | '*';
  pattern: string;  // "PI\\{tenant}\\{unit}\\*"
  extractionRegex: RegExp;
  tenantGroup?: number;  // Regex group number for tenant
  unitGroup?: number;    // Regex group number for unit
  assetGroup?: number;   // Regex group number for asset
  defaultTenantId?: string;
  defaultUnitId?: string;
  defaultAssetId?: string;
  priority: number;  // Higher priority checked first
  isActive: boolean;
}
```

### **Pattern Examples:**

1. **PI Path Pattern:**
   ```json
   {
     "pattern": "PI\\\\{tenant}\\\\{unit}\\\\*",
     "extractionRegex": "^PI\\\\([^\\\\]+)\\\\([^\\\\]+)\\\\",
     "tenantGroup": 1,
     "unitGroup": 2
   }
   ```

2. **MQTT Topic Pattern:**
   ```json
   {
     "pattern": "plant/{tenant}/unit/{unit}/events",
     "extractionRegex": "^plant\\/([^\\/]+)\\/unit\\/([^\\/]+)\\/",
     "tenantGroup": 1,
     "unitGroup": 2
   }
   ```

3. **Modbus Register Range:**
   ```json
   {
     "pattern": "Connection1:Registers:1000-1999",
     "defaultUnitId": "unit-123",
     "extractionRegex": "^Connection1:Registers:(\\d+)-(\\d+)"
   }
   ```

---

## 📈 Scalability Considerations

### **For 1 Million Events:**

**Option 1: Batch Processing (Recommended)**
```
- Load bindings once: ~100ms
- Load patterns once: ~50ms
- Process in chunks of 10,000: ~100 chunks
- Each chunk: ~200ms
- Total: ~20 seconds ✅
```

**Option 2: Parallel Processing**
```
- Split events into N batches (N = CPU cores)
- Process batches in parallel
- Merge results
- Total: ~5-10 seconds ✅✅
```

**Option 3: Database-Level Tagging**
```
- Store events with sourceId only
- Use SQL JOIN to tag during query
- Very fast for reads
- Total: Query-time only ✅✅✅
```

---

## 🔄 Hybrid Approach (Best Solution)

### **Phase 1: Initial Bulk Pull**
1. Load bindings + patterns (once)
2. Process events in batches (10k chunks)
3. Tag using in-memory map
4. Bulk insert into database
5. **Time: ~2-5 seconds per 10k events**

### **Phase 2: Real-Time Stream**
1. Keep binding map in memory (cache)
2. Tag events as they arrive (instant)
3. Buffer for 1-5 seconds or 1000 events
4. Bulk insert buffered events
5. **Latency: ~1-5 seconds**

### **Phase 3: Query-Time Enhancement**
1. Events stored with sourceId + tags
2. Can filter by unitId/assetId directly (indexed)
3. For untagged events, use JOIN query
4. **Query time: <100ms**

---

## 🎯 Recommended Implementation

### **For Event Pulling Service:**

```typescript
@Injectable()
export class UnifiedEventPullService {
  constructor(
    private readonly bulkTaggingService: BulkEventTaggingService,
    private readonly productionEventService: ProductionEventService,
  ) {}

  async pullEvents(request: UnifiedPullEventsRequest): Promise<UnifiedPullEventsResponse> {
    // 1. Fetch events from source
    const rawEvents = await this.fetchFromSource(request);
    
    // 2. Tag events in bulk (FAST)
    const taggedEvents = await this.bulkTaggingService.tagEvents(
      rawEvents,
      request.tenantId
    );
    
    // 3. Bulk insert into database
    const BATCH_SIZE = 5000;
    let created = 0;
    
    for (let i = 0; i < taggedEvents.length; i += BATCH_SIZE) {
      const batch = taggedEvents.slice(i, i + BATCH_SIZE);
      await this.productionEventService.createBatch(batch);  // Bulk create
      created += batch.length;
    }
    
    return {
      success: true,
      eventsFetched: rawEvents.length,
      eventsCreated: created,
      // ...
    };
  }
}
```

---

## ✅ Key Takeaways

1. **Never tag one-by-one** - Use batch lookup
2. **Use patterns for bulk tagging** - One pattern matches thousands
3. **Cache bindings/rules** - Load once, use many times
4. **Bulk database operations** - Insert in batches
5. **Hybrid approach** - Combine strategies for best performance

---

**Status:** 📋 Strategy Document Ready - Implementation Ready When Approved

