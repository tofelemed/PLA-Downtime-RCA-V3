# ⚡ Current vs Optimized Event Tagging - Performance Analysis

## 🚨 Current Implementation Problem

### **Current Code (Inefficient):**

Looking at `pi-event-pull.service.ts` lines 156-218:

```typescript
// ❌ PROBLEM: Loads bindings once (good)
const bindings = await this.afBindingRepository.find({
  where: { tenantId: request.tenantId },
});
const bindingMap = new Map(bindings.map(b => [b.webId, b]));

// ❌ PROBLEM: Processes events one-by-one in loop
for (const ef of eventFrames) {
  // ❌ Database query for EACH event (checking if exists)
  const existing = await this.piEventRepository.findOne({
    where: { webId: ef.WebId, tenantId: request.tenantId },
  });
  
  // ... create event data ...
  
  // ❌ Save ONE event at a time
  if (existing) {
    await this.piEventRepository.save(existing);  // ❌ Individual save
  } else {
    await this.piEventRepository.save(newEvent);  // ❌ Individual save
  }
  
  // ❌ Create production event one-by-one
  await this.createProductionEventFromPI(ef, ...);  // ❌ One-by-one
}
```

**Performance:**
- 10,000 events = 10,000+ database queries
- Sequential processing
- Estimated time: **~100-200 seconds** ❌

---

## ✅ Optimized Solution

### **Strategy 1: Batch Binding Lookup + Bulk Operations**

```typescript
// ✅ Load bindings ONCE (already good)
const bindings = await this.afBindingRepository.find({
  where: { tenantId: request.tenantId },
});
const bindingMap = new Map(bindings.map(b => [b.webId, b]));

// ✅ Load ALL existing events in ONE query
const existingWebIds = eventFrames.map(ef => ef.WebId);
const existingEvents = await this.piEventRepository.find({
  where: {
    webId: In(existingWebIds),  // ✅ Bulk lookup
    tenantId: request.tenantId,
  },
});
const existingMap = new Map(existingEvents.map(e => [e.webId, e]));

// ✅ Process ALL events in memory (bulk)
const eventsToCreate: PIEvent[] = [];
const eventsToUpdate: PIEvent[] = [];
const productionEventsToCreate: Partial<ProductionEvent>[] = [];

for (const ef of eventFrames) {
  const eventData = {
    webId: ef.WebId,
    tenantId: request.tenantId,
    // ... other fields
  };
  
  // ✅ Use in-memory map (no DB query)
  const existing = existingMap.get(ef.WebId);
  
  if (existing) {
    Object.assign(existing, eventData);
    eventsToUpdate.push(existing);
  } else {
    const newEvent = this.piEventRepository.create(eventData);
    eventsToCreate.push(newEvent);
  }
  
  // ✅ Tag production event in memory
  const binding = bindingMap.get(ef.PrimaryReferencedElement?.WebId);
  if (binding) {
    productionEventsToCreate.push({
      ...eventData,
      unitId: binding.boundType === 'unit' ? binding.localId : undefined,
      assetId: binding.boundType === 'asset' ? binding.localId : undefined,
    });
  }
}

// ✅ Bulk database operations
await this.piEventRepository.save([...eventsToCreate, ...eventsToUpdate]);  // ✅ Bulk
await this.productionEventRepository.save(productionEventsToCreate);  // ✅ Bulk
```

**Performance:**
- 10,000 events = 3-4 database queries total
- Bulk operations
- Estimated time: **~2-5 seconds** ✅

---

### **Strategy 2: Pattern-Based Rules for Bulk Tagging**

**Problem:** Individual bindings don't scale for thousands of similar events

**Solution:** Pattern rules

```typescript
// Pattern examples:
// "PI\\Plant1\\Line1\\*" → unitId = "line-1-id"
// "OPCUA\\Machine\\*" → assetId = "machine-id"
// "MQTT\\plant\\{tenant}\\unit\\{unit}\\*" → Extract from topic

// ✅ Load pattern rules once
const patternRules = await this.patternRuleService.findAll({
  where: { tenantId: request.tenantId, isActive: true },
  order: { priority: 'DESC' },  // Higher priority first
});

// ✅ Tag events using patterns
const taggedEvents = eventFrames.map(ef => {
  // Try explicit binding first
  const binding = bindingMap.get(ef.WebId);
  if (binding) {
    return applyBinding(ef, binding);
  }
  
  // Try pattern rules (one pattern matches many events)
  for (const rule of patternRules) {
    if (matchesPattern(ef.WebId, rule.pattern)) {
      const hierarchyIds = extractFromPattern(ef.WebId, rule);
      return { ...ef, ...hierarchyIds };
    }
  }
  
  return ef; // Untagged (can tag later)
});

// ✅ Bulk save
await this.eventRepository.save(taggedEvents);
```

**Performance:**
- 1 pattern rule can match 10,000+ events
- Very fast pattern matching
- Estimated time: **~1-3 seconds** ✅✅

---

## 📊 Performance Comparison

### **Scenario: 10,000 Events**

| Approach | DB Queries | Processing | Total Time |
|----------|-----------|------------|------------|
| **Current (One-by-One)** | 10,000+ | Sequential | ~100-200 sec ❌ |
| **Batch Lookup** | 3-4 | Bulk | ~2-5 sec ✅ |
| **Pattern Rules** | 2-3 | Bulk | ~1-3 sec ✅✅ |
| **Streaming + Batching** | 10-20 | Chunks | ~5-10 sec ✅ |

---

## 🎯 Recommended Implementation

### **Hybrid Approach (Best Performance):**

```typescript
async pullEvents(request: PullEventsRequest): Promise<PullEventsResponse> {
  // 1. ✅ Load bindings ONCE
  const bindings = await this.loadBindings(request.tenantId);
  const bindingMap = new Map(...);
  
  // 2. ✅ Load pattern rules ONCE
  const patternRules = await this.loadPatternRules(request.tenantId);
  
  // 3. ✅ Fetch events from source
  const eventFrames = await this.fetchFromPI(request);
  
  // 4. ✅ Bulk check existing events (ONE query)
  const existingEvents = await this.bulkCheckExisting(eventFrames);
  const existingMap = new Map(...);
  
  // 5. ✅ Process ALL events in memory
  const piEventsToSave: PIEvent[] = [];
  const productionEventsToCreate: Partial<ProductionEvent>[] = [];
  
  for (const ef of eventFrames) {
    // Tag using binding or pattern
    const tagged = this.tagEvent(ef, bindingMap, patternRules);
    
    // Check if exists (in-memory)
    const existing = existingMap.get(ef.WebId);
    
    if (existing) {
      Object.assign(existing, tagged);
      piEventsToSave.push(existing);
    } else {
      piEventsToSave.push(this.piEventRepository.create(tagged));
    }
    
    // Create production event if needed
    if (tagged.unitId || tagged.assetId) {
      productionEventsToCreate.push(this.createProductionEvent(tagged));
    }
  }
  
  // 6. ✅ Bulk save (in batches of 5000)
  await this.saveInBatches(piEventsToSave, 5000);
  await this.saveInBatches(productionEventsToCreate, 5000);
  
  return {
    eventsFetched: eventFrames.length,
    eventsStored: piEventsToSave.length,
    productionEventsCreated: productionEventsToCreate.length,
  };
}

private tagEvent(
  event: PIEventFrame,
  bindingMap: Map<string, Binding>,
  patternRules: PatternRule[]
): TaggedEvent {
  // Try explicit binding first
  const binding = bindingMap.get(event.PrimaryReferencedElement?.WebId);
  if (binding) {
    return {
      ...event,
      unitId: binding.boundType === 'unit' ? binding.localId : undefined,
      assetId: binding.boundType === 'asset' ? binding.localId : undefined,
    };
  }
  
  // Try pattern rules
  for (const rule of patternRules) {
    if (this.matchesPattern(event.WebId, rule.pattern)) {
      return {
        ...event,
        ...this.extractHierarchy(event.WebId, rule),
      };
    }
  }
  
  return event; // Untagged
}

private async saveInBatches<T>(items: T[], batchSize: number): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await this.repository.save(batch);  // ✅ Bulk save
  }
}
```

---

## 🔑 Key Optimizations

### **1. Load Once, Use Many:**
```typescript
// ❌ BAD: Load for each event
for (const event of events) {
  const binding = await findBinding(event.id);  // N queries
}

// ✅ GOOD: Load once, use map
const bindings = await findAllBindings();  // 1 query
const map = new Map(bindings.map(b => [b.sourceId, b]));
for (const event of events) {
  const binding = map.get(event.id);  // O(1) lookup
}
```

### **2. Bulk Database Operations:**
```typescript
// ❌ BAD: One-by-one
for (const event of events) {
  await repository.save(event);  // N queries
}

// ✅ GOOD: Bulk save
await repository.save(events);  // 1 query (or few batches)
```

### **3. In-Memory Processing:**
```typescript
// ❌ BAD: Query database for each check
for (const event of events) {
  const existing = await repository.findOne({ where: { id: event.id } });
}

// ✅ GOOD: Load all, check in memory
const allExisting = await repository.find({ where: { id: In(eventIds) } });
const existingMap = new Map(allExisting.map(e => [e.id, e]));
for (const event of events) {
  const existing = existingMap.get(event.id);  // O(1) lookup
}
```

### **4. Pattern Matching:**
```typescript
// ❌ BAD: Individual bindings for similar events
// 10,000 bindings for 10,000 similar events

// ✅ GOOD: One pattern for many events
// 1 pattern rule: "PI\\Plant1\\*" → matches 10,000 events
```

---

## 📈 Scalability Analysis

### **For 100,000 Events:**

**Current Approach:**
- 100,000+ database queries
- Time: ~1,000-2,000 seconds (16-33 minutes) ❌

**Optimized Approach:**
- ~20 database queries (batches)
- Time: ~20-50 seconds ✅

**Improvement: 40-100x faster!**

---

## 🎯 Answer to Your Question

**Q: "What if there are many events, how can they be tagged one by one?"**

**A: They SHOULDN'T be tagged one by one!**

**Solutions:**
1. ✅ **Load bindings once** - Create in-memory map
2. ✅ **Use pattern rules** - One pattern matches thousands
3. ✅ **Bulk process** - Process all events in memory
4. ✅ **Bulk save** - Save in batches
5. ✅ **Cache bindings** - Load once, reuse

**Result:** 10,000 events tagged in **2-5 seconds** instead of **100+ seconds**!

---

**Status:** 📋 Analysis Complete - Ready to Implement Optimization

