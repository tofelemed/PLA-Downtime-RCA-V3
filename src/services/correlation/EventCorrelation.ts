import { EventBus, globalEventBus } from '@/services/events/EventBus';

// Backend-ready interfaces
export interface IEventCorrelation {
  addRule(rule: CorrelationRule): Promise<void>;
  removeRule(ruleId: string): Promise<void>;
  getRules(): Promise<CorrelationRule[]>;
  correlate(events: Event[]): Promise<CorrelationResult[]>;
  getPatterns(): Promise<Pattern[]>;
  getCorrelationMetrics(): Promise<CorrelationMetrics>;
  processEvent(event: Event): Promise<void>;
}

export interface Event {
  id: string;
  timestamp: Date;
  source: string;
  type: string;
  data: any;
  metadata?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  tags?: string[];
}

export interface CorrelationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: CorrelationCondition[];
  actions: CorrelationAction[];
  timeWindow: number; // seconds
  threshold: number; // minimum events to trigger
  cooldown: number; // seconds between triggers
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface CorrelationCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'regex' | 'greater_than' | 'less_than' | 'in_range' | 'exists';
  value: any;
  timeConstraint?: number; // seconds
  sourceConstraint?: string[];
  typeConstraint?: string[];
  severityConstraint?: string[];
}

export interface CorrelationAction {
  id: string;
  type: 'create_alert' | 'send_notification' | 'trigger_workflow' | 'update_dashboard' | 'log_event' | 'custom';
  config: Record<string, any>;
  enabled: boolean;
}

export interface CorrelationResult {
  id: string;
  ruleId: string;
  ruleName: string;
  events: Event[];
  timestamp: Date;
  confidence: number; // 0-1
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata?: Record<string, any>;
}

export interface Pattern {
  id: string;
  name: string;
  description?: string;
  events: Event[];
  frequency: number;
  firstSeen: Date;
  lastSeen: Date;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface CorrelationMetrics {
  totalRules: number;
  activeRules: number;
  totalCorrelations: number;
  totalPatterns: number;
  averageConfidence: number;
  lastCorrelation: Date;
  topPatterns: Pattern[];
  correlationBySeverity: Record<string, number>;
}

// IndexedDB Storage Service
class CorrelationStorageService {
  private dbName = 'EventCorrelationDB';
  private dbVersion = 1;
  private stores = {
    rules: 'correlation_rules',
    results: 'correlation_results',
    patterns: 'patterns',
    events: 'correlated_events'
  };

  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Rules store
        if (!db.objectStoreNames.contains(this.stores.rules)) {
          const store = db.createObjectStore(this.stores.rules, { keyPath: 'id' });
          store.createIndex('enabled', 'enabled', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
          store.createIndex('category', 'category', { unique: false });
        }
        
        // Results store
        if (!db.objectStoreNames.contains(this.stores.results)) {
          const store = db.createObjectStore(this.stores.results, { keyPath: 'id' });
          store.createIndex('ruleId', 'ruleId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('severity', 'severity', { unique: false });
        }
        
        // Patterns store
        if (!db.objectStoreNames.contains(this.stores.patterns)) {
          const store = db.createObjectStore(this.stores.patterns, { keyPath: 'id' });
          store.createIndex('severity', 'severity', { unique: false });
          store.createIndex('frequency', 'frequency', { unique: false });
          store.createIndex('lastSeen', 'lastSeen', { unique: false });
        }
        
        // Events store
        if (!db.objectStoreNames.contains(this.stores.events)) {
          const store = db.createObjectStore(this.stores.events, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('source', 'source', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  async saveRule(rule: CorrelationRule): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.rules], 'readwrite');
      const store = transaction.objectStore(this.stores.rules);
      const request = store.put(rule);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRule(ruleId: string): Promise<CorrelationRule | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.rules], 'readonly');
      const store = transaction.objectStore(this.stores.rules);
      const request = store.get(ruleId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRules(): Promise<CorrelationRule[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.rules], 'readonly');
      const store = transaction.objectStore(this.stores.rules);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRule(ruleId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.rules], 'readwrite');
      const store = transaction.objectStore(this.stores.rules);
      const request = store.delete(ruleId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveResult(result: CorrelationResult): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.results], 'readwrite');
      const store = transaction.objectStore(this.stores.results);
      const request = store.put(result);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getResults(limit?: number): Promise<CorrelationResult[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.results], 'readonly');
      const store = transaction.objectStore(this.stores.results);
      const index = store.index('timestamp');
      const request = index.getAll();
      
      request.onsuccess = () => {
        let results = request.result || [];
        results = results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (limit) {
          results = results.slice(0, limit);
        }
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async savePattern(pattern: Pattern): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.patterns], 'readwrite');
      const store = transaction.objectStore(this.stores.patterns);
      const request = store.put(pattern);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPatterns(): Promise<Pattern[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.patterns], 'readonly');
      const store = transaction.objectStore(this.stores.patterns);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async cleanupOldData(retentionDays: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const db = await this.initDB();
    const transaction = db.transaction([this.stores.results, this.stores.events], 'readwrite');
    
    // Clean up old results
    const resultsStore = transaction.objectStore(this.stores.results);
    const resultsIndex = resultsStore.index('timestamp');
    const resultsRequest = resultsIndex.openCursor(IDBKeyRange.upperBound(cutoffDate));
    
    resultsRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    
    // Clean up old events
    const eventsStore = transaction.objectStore(this.stores.events);
    const eventsIndex = eventsStore.index('timestamp');
    const eventsRequest = eventsIndex.openCursor(IDBKeyRange.upperBound(cutoffDate));
    
    eventsRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }
}

// Main Event Correlation Implementation
export class EventCorrelation implements IEventCorrelation {
  private storage: CorrelationStorageService;
  private eventBus: EventBus;
  private rules: Map<string, CorrelationRule> = new Map();
  private eventBuffer: Event[] = [];
  private processingQueue: Event[] = [];
  private isProcessing: boolean = false;
  private cleanupInterval?: NodeJS.Timeout;
  private metrics: CorrelationMetrics;

  constructor(eventBus: EventBus) {
    this.storage = new CorrelationStorageService();
    this.eventBus = eventBus;
    this.metrics = {
      totalRules: 0,
      activeRules: 0,
      totalCorrelations: 0,
      totalPatterns: 0,
      averageConfidence: 0,
      lastCorrelation: new Date(),
      topPatterns: [],
      correlationBySeverity: {}
    };
    
    this.initializeCleanup();
    this.loadRules();
  }

  async addRule(rule: CorrelationRule): Promise<void> {
    // Validate rule
    if (!rule.name || rule.conditions.length === 0) {
      throw new Error('Invalid correlation rule');
    }

    // Set timestamps
    rule.createdAt = new Date();
    rule.updatedAt = new Date();
    
    // Save to storage
    await this.storage.saveRule(rule);
    
    // Add to memory cache
    this.rules.set(rule.id, rule);
    
    // Update metrics
    await this.updateMetrics();
    
    // Publish event
    this.eventBus.publish('correlation:rule:added', { rule });
    
    // Emit to backend when available
    this.emitToBackend('correlation:rule:added', { rule });
  }

  async removeRule(ruleId: string): Promise<void> {
    await this.storage.deleteRule(ruleId);
    this.rules.delete(ruleId);
    await this.updateMetrics();
    
    this.eventBus.publish('correlation:rule:removed', { ruleId });
    this.emitToBackend('correlation:rule:removed', { ruleId });
  }

  async getRules(): Promise<CorrelationRule[]> {
    return Array.from(this.rules.values());
  }

  async correlate(events: Event[]): Promise<CorrelationResult[]> {
    const results: CorrelationResult[] = [];
    
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      
      const matchingEvents = this.findMatchingEvents(rule, events);
      if (matchingEvents.length >= rule.threshold) {
        const result = await this.createCorrelationResult(rule, matchingEvents);
        results.push(result);
        
        // Save result
        await this.storage.saveResult(result);
        
        // Execute actions
        await this.executeActions(rule.actions, result);
      }
    }
    
    return results;
  }

  async getPatterns(): Promise<Pattern[]> {
    return this.storage.getPatterns();
  }

  async getCorrelationMetrics(): Promise<CorrelationMetrics> {
    return this.metrics;
  }

  async processEvent(event: Event): Promise<void> {
    // Add to buffer
    this.eventBuffer.push(event);
    
    // Maintain buffer size (keep last 1000 events)
    if (this.eventBuffer.length > 1000) {
      this.eventBuffer = this.eventBuffer.slice(-1000);
    }
    
    // Add to processing queue
    this.processingQueue.push(event);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    
    while (this.processingQueue.length > 0) {
      const batch = this.processingQueue.splice(0, 10); // Process in batches of 10
      
      // Check correlations for this batch
      const results = await this.correlate(batch);
      
      // Update patterns
      for (const result of results) {
        await this.updatePatterns(result);
      }
      
      // Update metrics
      this.metrics.totalCorrelations += results.length;
      if (results.length > 0) {
        this.metrics.lastCorrelation = new Date();
      }
    }
    
    this.isProcessing = false;
  }

  private findMatchingEvents(rule: CorrelationRule, events: Event[]): Event[] {
    const matchingEvents: Event[] = [];
    const now = new Date();
    
    for (const event of events) {
      let matches = true;
      
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(event, condition)) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        // Check time window
        const timeDiff = (now.getTime() - event.timestamp.getTime()) / 1000;
        if (timeDiff <= rule.timeWindow) {
          matchingEvents.push(event);
        }
      }
    }
    
    return matchingEvents;
  }

  private evaluateCondition(event: Event, condition: CorrelationCondition): boolean {
    const fieldValue = this.getNestedValue(event, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'regex':
        try {
          const regex = new RegExp(condition.value as string);
          return regex.test(String(fieldValue));
        } catch {
          return false;
        }
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'in_range':
        if (Array.isArray(condition.value) && condition.value.length === 2) {
          const numValue = Number(fieldValue);
          return numValue >= condition.value[0] && numValue <= condition.value[1];
        }
        return false;
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async createCorrelationResult(rule: CorrelationRule, events: Event[]): Promise<CorrelationResult> {
    const confidence = this.calculateConfidence(rule, events);
    const severity = this.calculateSeverity(events);
    
    const result: CorrelationResult = {
      id: `correlation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      events,
      timestamp: new Date(),
      confidence,
      severity,
      message: `Correlation detected: ${rule.name} (${events.length} events)`,
      metadata: {
        ruleDescription: rule.description,
        timeWindow: rule.timeWindow,
        threshold: rule.threshold
      }
    };
    
    return result;
  }

  private calculateConfidence(rule: CorrelationRule, events: Event[]): number {
    // Simple confidence calculation based on rule complexity and event count
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on event count vs threshold
    if (events.length > rule.threshold) {
      confidence += 0.2;
    }
    
    // Increase confidence based on rule complexity
    if (rule.conditions.length > 1) {
      confidence += 0.1;
    }
    
    // Increase confidence if time window is small (more precise)
    if (rule.timeWindow < 60) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  private calculateSeverity(events: Event[]): 'low' | 'medium' | 'high' | 'critical' {
    const severities = events.map(e => e.severity).filter(Boolean);
    
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }

  private async executeActions(actions: CorrelationAction[], result: CorrelationResult): Promise<void> {
    for (const action of actions) {
      if (!action.enabled) continue;
      
      try {
        switch (action.type) {
          case 'create_alert':
            this.eventBus.publish('correlation:alert:created', { result, action });
            break;
          case 'send_notification':
            this.eventBus.publish('correlation:notification:send', { result, action });
            break;
          case 'trigger_workflow':
            this.eventBus.publish('correlation:workflow:triggered', { result, action });
            break;
          case 'update_dashboard':
            this.eventBus.publish('correlation:dashboard:updated', { result, action });
            break;
          case 'log_event':
            this.eventBus.publish('correlation:event:logged', { result, action });
            break;
          case 'custom':
            this.eventBus.publish('correlation:custom:action', { result, action });
            break;
        }
        
        // Emit to backend
        this.emitToBackend(`correlation:action:${action.type}`, { result, action });
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error);
      }
    }
  }

  private async updatePatterns(result: CorrelationResult): Promise<void> {
    const patterns = await this.storage.getPatterns();
    const existingPattern = patterns.find(p => p.ruleId === result.ruleId);
    
    if (existingPattern) {
      // Update existing pattern
      existingPattern.events = [...existingPattern.events, ...result.events];
      existingPattern.frequency += 1;
      existingPattern.lastSeen = new Date();
      existingPattern.confidence = (existingPattern.confidence + result.confidence) / 2;
      
      await this.storage.savePattern(existingPattern);
    } else {
      // Create new pattern
      const pattern: Pattern = {
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: result.ruleName,
        description: `Pattern detected for rule: ${result.ruleName}`,
        events: result.events,
        frequency: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        confidence: result.confidence,
        severity: result.severity,
        metadata: {
          ruleId: result.ruleId
        }
      };
      
      await this.storage.savePattern(pattern);
    }
  }

  private async loadRules(): Promise<void> {
    try {
      const rules = await this.storage.getAllRules();
      rules.forEach(rule => this.rules.set(rule.id, rule));
      await this.updateMetrics();
    } catch (error) {
      console.error('Failed to load correlation rules:', error);
    }
  }

  private async updateMetrics(): Promise<void> {
    this.metrics.totalRules = this.rules.size;
    this.metrics.activeRules = Array.from(this.rules.values()).filter(r => r.enabled).length;
    
    const patterns = await this.storage.getPatterns();
    this.metrics.totalPatterns = patterns.length;
    
    if (patterns.length > 0) {
      this.metrics.averageConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
      this.metrics.topPatterns = patterns
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5);
    }
    
    // Calculate correlation by severity
    const results = await this.storage.getResults();
    this.metrics.correlationBySeverity = results.reduce((acc, result) => {
      acc[result.severity] = (acc[result.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private initializeCleanup(): void {
    // Clean up old data every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.storage.cleanupOldData(30); // Keep 30 days of data
      } catch (error) {
        console.error('Correlation data cleanup failed:', error);
      }
    }, 60 * 60 * 1000);
  }

  // Backend migration support
  private emitToBackend(event: string, data: any): void {
    // This will be replaced with actual backend API calls
    console.log(`[Backend] ${event}:`, data);
    
    // When backend is available, this will be:
    // await fetch('/api/correlation/events', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ event, data })
    // });
  }

  // Cleanup method for backend migration
  async migrateToBackend(): Promise<void> {
    const rules = await this.getRules();
    const results = await this.storage.getResults();
    const patterns = await this.storage.getPatterns();
    
    // Send all data to backend
    for (const rule of rules) {
      await this.emitToBackend('correlation:rule:migrate', { rule });
    }
    
    for (const result of results) {
      await this.emitToBackend('correlation:result:migrate', { result });
    }
    
    for (const pattern of patterns) {
      await this.emitToBackend('correlation:pattern:migrate', { pattern });
    }
    
    console.log('Correlation data migrated to backend');
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
export const globalEventCorrelation = new EventCorrelation(globalEventBus);
