import { EventBus, globalEventBus } from '@/services/events/EventBus';

// Backend-ready interfaces
export interface IFilterEngine {
  addFilter(filter: DataFilter): Promise<void>;
  removeFilter(filterId: string): Promise<void>;
  getFilters(): Promise<DataFilter[]>;
  applyFilters(data: any): Promise<FilteredData>;
  getFilterMetrics(): Promise<FilterMetrics>;
  validateFilter(filter: DataFilter): Promise<ValidationResult>;
}

export interface DataFilter {
  id: string;
  name: string;
  type: FilterType;
  enabled: boolean;
  config: FilterConfig;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export type FilterType = 
  | 'field_filter'
  | 'value_filter'
  | 'range_filter'
  | 'regex_filter'
  | 'custom_filter'
  | 'aggregate_filter';

export interface FilterConfig {
  field?: string;
  operator: FilterOperator;
  value?: any;
  conditions?: FilterCondition[];
  customLogic?: string;
}

export type FilterOperator = 
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'contains'
  | 'not_contains'
  | 'regex'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: any;
  logic: 'AND' | 'OR';
}

export interface FilteredData {
  originalData: any;
  filteredData: any;
  appliedFilters: string[];
  excludedCount: number;
  includedCount: number;
  processingTime: number;
}

export interface FilterMetrics {
  totalFilters: number;
  activeFilters: number;
  totalProcessed: number;
  totalFiltered: number;
  averageProcessingTime: number;
  lastProcessed: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// IndexedDB Storage Service
class FilterStorageService {
  private dbName = 'FilterEngineDB';
  private dbVersion = 1;
  private storeName = 'filters';

  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('enabled', 'enabled', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
        }
      };
    });
  }

  async saveFilter(filter: DataFilter): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(filter);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFilter(filterId: string): Promise<DataFilter | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(filterId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFilters(): Promise<DataFilter[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFilter(filterId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(filterId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateFilter(filter: DataFilter): Promise<void> {
    return this.saveFilter(filter);
  }
}

// Concrete Filter Implementations
export class FieldFilter {
  static apply(data: any, config: FilterConfig): boolean {
    if (!config.field) return true;
    
    const fieldValue = this.getNestedValue(data, config.field);
    
    switch (config.operator) {
      case 'equals':
        return fieldValue === config.value;
      case 'not_equals':
        return fieldValue !== config.value;
      case 'greater_than':
        return Number(fieldValue) > Number(config.value);
      case 'less_than':
        return Number(fieldValue) < Number(config.value);
      case 'greater_equal':
        return Number(fieldValue) >= Number(config.value);
      case 'less_equal':
        return Number(fieldValue) <= Number(config.value);
      case 'contains':
        return String(fieldValue).includes(String(config.value));
      case 'not_contains':
        return !String(fieldValue).includes(String(config.value));
      case 'regex':
        try {
          const regex = new RegExp(config.value as string);
          return regex.test(String(fieldValue));
        } catch {
          return false;
        }
      case 'in':
        return Array.isArray(config.value) && config.value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(config.value) && !config.value.includes(fieldValue);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      default:
        return true;
    }
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

export class RangeFilter {
  static apply(data: any, config: FilterConfig): boolean {
    if (!config.field || !config.conditions) return true;
    
    const fieldValue = FieldFilter.getNestedValue(data, config.field);
    const numValue = Number(fieldValue);
    
    if (isNaN(numValue)) return false;
    
    return config.conditions.every(condition => {
      const conditionValue = Number(condition.value);
      switch (condition.operator) {
        case 'greater_than':
          return numValue > conditionValue;
        case 'less_than':
          return numValue < conditionValue;
        case 'greater_equal':
          return numValue >= conditionValue;
        case 'less_equal':
          return numValue <= conditionValue;
        default:
          return true;
      }
    });
  }
}

export class CustomFilter {
  static apply(data: any, config: FilterConfig): boolean {
    if (!config.customLogic) return true;
    
    try {
      // Create a safe evaluation context
      const context = {
        data,
        field: (path: string) => FieldFilter.getNestedValue(data, path),
        value: (path: string) => FieldFilter.getNestedValue(data, path),
        math: Math,
        date: Date,
        string: String,
        number: Number,
        array: Array,
        object: Object
      };
      
      // Evaluate custom logic (in production, use a safer expression evaluator)
      const func = new Function('context', `with(context) { return ${config.customLogic}; }`);
      return func(context);
    } catch (error) {
      console.error('Custom filter evaluation error:', error);
      return false;
    }
  }
}

// Main Filter Engine Implementation
export class FilterEngine implements IFilterEngine {
  private storage: FilterStorageService;
  private eventBus: EventBus;
  private metrics: FilterMetrics;
  private processingQueue: Array<{ data: any; filters: DataFilter[] }> = [];
  private isProcessing: boolean = false;

  constructor(eventBus: IEventBus) {
    this.storage = new FilterStorageService();
    this.eventBus = eventBus;
    this.metrics = {
      totalFilters: 0,
      activeFilters: 0,
      totalProcessed: 0,
      totalFiltered: 0,
      averageProcessingTime: 0,
      lastProcessed: new Date()
    };
    
    this.initializeMetrics();
  }

  async addFilter(filter: DataFilter): Promise<void> {
    // Validate filter
    const validation = await this.validateFilter(filter);
    if (!validation.isValid) {
      throw new Error(`Invalid filter: ${validation.errors.join(', ')}`);
    }

    // Set timestamps
    filter.createdAt = new Date();
    filter.updatedAt = new Date();
    
    // Save to storage
    await this.storage.saveFilter(filter);
    
    // Update metrics
    await this.updateMetrics();
    
    // Publish event
    this.eventBus.publish('filter:added', { filter });
    
    // Emit to backend when available
    this.emitToBackend('filter:added', { filter });
  }

  async removeFilter(filterId: string): Promise<void> {
    await this.storage.deleteFilter(filterId);
    await this.updateMetrics();
    
    this.eventBus.publish('filter:removed', { filterId });
    this.emitToBackend('filter:removed', { filterId });
  }

  async getFilters(): Promise<DataFilter[]> {
    return this.storage.getAllFilters();
  }

  async applyFilters(data: any): Promise<FilteredData> {
    const startTime = performance.now();
    
    // Get active filters
    const filters = (await this.getFilters()).filter(f => f.enabled);
    
    // Apply filters
    let filteredData = data;
    const appliedFilters: string[] = [];
    let excludedCount = 0;
    let includedCount = 0;
    
    for (const filter of filters.sort((a, b) => a.priority - b.priority)) {
      let passed = false;
      
      switch (filter.type) {
        case 'field_filter':
        case 'value_filter':
          passed = FieldFilter.apply(data, filter.config);
          break;
        case 'range_filter':
          passed = RangeFilter.apply(data, filter.config);
          break;
        case 'custom_filter':
          passed = CustomFilter.apply(data, filter.config);
          break;
        default:
          passed = true;
      }
      
      if (passed) {
        appliedFilters.push(filter.id);
        includedCount++;
      } else {
        excludedCount++;
        filteredData = null; // Data was filtered out
        break;
      }
    }
    
    const processingTime = performance.now() - startTime;
    
    // Update metrics
    this.metrics.totalProcessed++;
    this.metrics.totalFiltered += excludedCount;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.totalProcessed - 1) + processingTime) / this.metrics.totalProcessed;
    this.metrics.lastProcessed = new Date();
    
    const result: FilteredData = {
      originalData: data,
      filteredData: filteredData,
      appliedFilters,
      excludedCount,
      includedCount,
      processingTime
    };
    
    // Publish event
    this.eventBus.publish('filter:applied', { result, filters: appliedFilters });
    
    return result;
  }

  async getFilterMetrics(): Promise<FilterMetrics> {
    return this.metrics;
  }

  async validateFilter(filter: DataFilter): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Basic validation
    if (!filter.name || filter.name.trim().length === 0) {
      errors.push('Filter name is required');
    }
    
    if (!filter.type) {
      errors.push('Filter type is required');
    }
    
    if (!filter.config) {
      errors.push('Filter configuration is required');
    }
    
    if (filter.priority < 0 || filter.priority > 1000) {
      warnings.push('Priority should be between 0 and 1000');
    }
    
    // Type-specific validation
    if (filter.type === 'field_filter' && !filter.config.field) {
      errors.push('Field filter requires a field path');
    }
    
    if (filter.type === 'custom_filter' && !filter.config.customLogic) {
      errors.push('Custom filter requires custom logic');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Batch processing for performance
  async processBatch(dataArray: any[]): Promise<FilteredData[]> {
    const results: FilteredData[] = [];
    
    for (const data of dataArray) {
      const result = await this.applyFilters(data);
      results.push(result);
    }
    
    return results;
  }

  // Queue-based processing for high-volume data
  async queueForProcessing(data: any, filters?: DataFilter[]): Promise<void> {
    this.processingQueue.push({ data, filters: filters || [] });
    
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
      const results = await Promise.all(
        batch.map(item => this.applyFilters(item.data))
      );
      
      // Publish batch results
      this.eventBus.publish('filter:batch_processed', { results });
    }
    
    this.isProcessing = false;
  }

  private async initializeMetrics(): Promise<void> {
    const filters = await this.getFilters();
    this.metrics.totalFilters = filters.length;
    this.metrics.activeFilters = filters.filter(f => f.enabled).length;
  }

  private async updateMetrics(): Promise<void> {
    const filters = await this.getFilters();
    this.metrics.totalFilters = filters.length;
    this.metrics.activeFilters = filters.filter(f => f.enabled).length;
  }

  // Backend migration support
  private emitToBackend(event: string, data: any): void {
    // This will be replaced with actual backend API calls
    // For now, just log the event
    console.log(`[Backend] ${event}:`, data);
    
    // When backend is available, this will be:
    // await fetch('/api/filters/events', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ event, data })
    // });
  }

  // Cleanup method for backend migration
  async migrateToBackend(): Promise<void> {
    const filters = await this.getFilters();
    
    // Send all filters to backend
    for (const filter of filters) {
      await this.emitToBackend('filter:migrate', { filter });
    }
    
    // Clear local storage
    for (const filter of filters) {
      await this.storage.deleteFilter(filter.id);
    }
    
    console.log('Filters migrated to backend');
  }
}

// Factory for creating filter instances
export class FilterFactory {
  static createFilter(type: FilterType, config: FilterConfig, name: string): DataFilter {
    return {
      id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      enabled: true,
      config,
      priority: 100,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

// Export singleton instance
export const globalFilterEngine = new FilterEngine(globalEventBus);
