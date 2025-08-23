// Stream Processing Pipeline for real-time data transformation and filtering
// This can be easily replaced with backend services later

import { 
  TransformConfig, 
  FilterConfig, 
  StreamConfig,
  DataQualityMetrics 
} from '../integrations/base/IConnector';
import { globalEventBus } from '../events/EventBus';

export interface StreamEvent {
  id: string;
  timestamp: Date;
  source: string;
  type: string;
  data: any;
  metadata?: Record<string, any>;
  quality: DataQualityMetrics;
  correlationId?: string;
}

export interface ProcessedEvent extends StreamEvent {
  transforms: string[];
  filters: string[];
  processingTime: number;
  alerts: Alert[];
  enrichedData?: Record<string, any>;
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'critical';
  message: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
}

export interface ProcessingMetrics {
  totalEvents: number;
  processedEvents: number;
  droppedEvents: number;
  averageProcessingTime: number;
  transformCount: number;
  filterCount: number;
  alertCount: number;
  lastProcessed?: Date;
  throughput: number; // events per second
}

export interface ProcessingConfig {
  enableTransforms: boolean;
  enableFilters: boolean;
  enableAlerts: boolean;
  enableMetrics: boolean;
  maxProcessingTime: number; // milliseconds
  bufferSize: number;
  batchSize: number;
  retryAttempts: number;
}

export class StreamProcessor {
  private transforms: Map<string, TransformConfig> = new Map();
  private filters: Map<string, FilterConfig> = new Map();
  private config: ProcessingConfig;
  private metrics: ProcessingMetrics;
  private eventBuffer: StreamEvent[] = [];
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;

  constructor(config: ProcessingConfig = {}) {
    this.config = {
      enableTransforms: true,
      enableFilters: true,
      enableAlerts: true,
      enableMetrics: true,
      maxProcessingTime: 1000,
      bufferSize: 10000,
      batchSize: 100,
      retryAttempts: 3,
      ...config
    };

    this.metrics = {
      totalEvents: 0,
      processedEvents: 0,
      droppedEvents: 0,
      averageProcessingTime: 0,
      transformCount: 0,
      filterCount: 0,
      alertCount: 0,
      throughput: 0
    };

    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }
  }

  // Add a data transform
  addTransform(transform: TransformConfig): void {
    this.transforms.set(transform.id, transform);
    this.metrics.transformCount = this.transforms.size;
    
    console.log(`🔧 Added transform: ${transform.name} (${transform.type})`);
    
    // Emit transform added event
    globalEventBus.publish('streaming.transform.added', {
      transform,
      timestamp: new Date()
    });
  }

  // Remove a data transform
  removeTransform(transformId: string): boolean {
    const removed = this.transforms.delete(transformId);
    if (removed) {
      this.metrics.transformCount = this.transforms.size;
      console.log(`🗑️ Removed transform: ${transformId}`);
      
      // Emit transform removed event
      globalEventBus.publish('streaming.transform.removed', {
        transformId,
        timestamp: new Date()
      });
    }
    return removed;
  }

  // Get all transforms
  getTransforms(): TransformConfig[] {
    return Array.from(this.transforms.values()).sort((a, b) => a.order - b.order);
  }

  // Add a data filter
  addFilter(filter: FilterConfig): void {
    this.filters.set(filter.id, filter);
    this.metrics.filterCount = this.filters.size;
    
    console.log(`🔍 Added filter: ${filter.name} (${filter.type})`);
    
    // Emit filter added event
    globalEventBus.publish('streaming.filter.added', {
      filter,
      timestamp: new Date()
    });
  }

  // Remove a data filter
  removeFilter(filterId: string): boolean {
    const removed = this.filters.delete(filterId);
    if (removed) {
      this.metrics.filterCount = this.filters.size;
      console.log(`🗑️ Removed filter: ${filterId}`);
      
      // Emit filter removed event
      globalEventBus.publish('streaming.filter.removed', {
        filterId,
        timestamp: new Date()
      });
    }
    return removed;
  }

  // Get all filters
  getFilters(): FilterConfig[] {
    return Array.from(this.filters.values()).sort((a, b) => a.order - b.order);
  }

  // Process a single event
  async processEvent(event: StreamEvent): Promise<ProcessedEvent | null> {
    const startTime = Date.now();
    
    try {
      this.metrics.totalEvents++;
      
      // Apply filters first
      if (this.config.enableFilters && !this.applyFilters(event)) {
        this.metrics.droppedEvents++;
        console.log(`🚫 Event ${event.id} dropped by filters`);
        return null;
      }

      // Apply transforms
      let processedData = event.data;
      const appliedTransforms: string[] = [];
      
      if (this.config.enableTransforms) {
        for (const transform of this.getTransforms()) {
          if (!transform.enabled) continue;
          
          try {
            processedData = await this.applyTransform(transform, processedData, event);
            appliedTransforms.push(transform.name);
          } catch (error) {
            console.error(`❌ Error applying transform ${transform.name}:`, error);
            
            // Emit transform error event
            globalEventBus.publish('streaming.transform.error', {
              transformId: transform.id,
              transformName: transform.name,
              eventId: event.id,
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date()
            });
          }
        }
      }

      // Check for alerts
      const alerts: Alert[] = [];
      if (this.config.enableAlerts) {
        alerts.push(...this.checkForAlerts(event, processedData));
      }

      const processingTime = Date.now() - startTime;
      
      // Update metrics
      this.updateProcessingMetrics(processingTime);
      
      const processedEvent: ProcessedEvent = {
        ...event,
        data: processedData,
        transforms: appliedTransforms,
        filters: this.getFilters().filter(f => f.enabled).map(f => f.name),
        processingTime,
        alerts,
        enrichedData: this.enrichEventData(event, processedData)
      };

      this.metrics.processedEvents++;
      
      // Emit processed event
      globalEventBus.publish('streaming.event.processed', {
        originalEvent: event,
        processedEvent,
        processingTime,
        timestamp: new Date()
      });

      return processedEvent;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Error processing event ${event.id}:`, error);
      
      // Emit processing error event
      globalEventBus.publish('streaming.event.error', {
        event,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        timestamp: new Date()
      });

      return null;
    }
  }

  // Process multiple events in batch
  async processBatch(events: StreamEvent[]): Promise<ProcessedEvent[]> {
    const processedEvents: ProcessedEvent[] = [];
    
    for (const event of events) {
      const processed = await this.processEvent(event);
      if (processed) {
        processedEvents.push(processed);
      }
    }
    
    return processedEvents;
  }

  // Start continuous processing
  startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    console.log('🚀 Starting stream processing...');

    // Process events at regular intervals
    this.processingInterval = setInterval(() => {
      this.processEventBuffer();
    }, 100); // Process every 100ms

    // Emit processing started event
    globalEventBus.publish('streaming.processing.started', {
      timestamp: new Date(),
      config: this.config
    });
  }

  // Stop continuous processing
  stopProcessing(): void {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    console.log('🛑 Stopped stream processing');

    // Emit processing stopped event
    globalEventBus.publish('streaming.processing.stopped', {
      timestamp: new Date()
    });
  }

  // Add event to buffer for batch processing
  addToBuffer(event: StreamEvent): void {
    this.eventBuffer.push(event);
    
    // Maintain buffer size limit
    if (this.eventBuffer.length > this.config.bufferSize) {
      this.eventBuffer = this.eventBuffer.slice(-this.config.bufferSize);
    }
  }

  // Get processing metrics
  getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics = {
      totalEvents: 0,
      processedEvents: 0,
      droppedEvents: 0,
      averageProcessingTime: 0,
      transformCount: this.transforms.size,
      filterCount: this.filters.size,
      alertCount: 0,
      throughput: 0
    };
  }

  // Get buffer status
  getBufferStatus(): { size: number; capacity: number; utilization: number } {
    return {
      size: this.eventBuffer.length,
      capacity: this.config.bufferSize,
      utilization: (this.eventBuffer.length / this.config.bufferSize) * 100
    };
  }

  // Private methods

  private applyFilters(event: StreamEvent): boolean {
    for (const filter of this.getFilters()) {
      if (!filter.enabled) continue;

      try {
        switch (filter.type) {
          case 'topic':
            if (!this.matchesTopicPattern(event.source, filter.config.pattern)) {
              return false;
            }
            break;
            
          case 'data':
            if (!this.matchesDataFilter(event.data, filter.config.condition)) {
              return false;
            }
            break;
            
          case 'timestamp':
            if (!this.matchesTimestampFilter(event.timestamp, filter.config.condition)) {
              return false;
            }
            break;
            
          case 'quality':
            if (!this.matchesQualityFilter(event.quality, filter.config.condition)) {
              return false;
            }
            break;
            
          case 'custom':
            if (filter.config.validator && !filter.config.validator(event)) {
              return false;
            }
            break;
        }
      } catch (error) {
        console.error(`Error applying filter ${filter.name}:`, error);
        return false;
      }
    }

    return true;
  }

  private async applyTransform(transform: TransformConfig, data: any, event: StreamEvent): Promise<any> {
    switch (transform.type) {
      case 'payload':
        return this.transformPayload(data, transform.config);
        
      case 'enrich':
        return this.enrichData(data, transform.config, event);
        
      case 'aggregate':
        return this.aggregateData(data, transform.config);
        
      case 'validate':
        return this.validateData(data, transform.config);
        
      case 'custom':
        if (transform.config.transform) {
          return transform.config.transform(data, event);
        }
        return data;
        
      default:
        return data;
    }
  }

  private transformPayload(data: any, config: any): any {
    switch (config.operation) {
      case 'uppercase':
        return typeof data === 'string' ? data.toUpperCase() : data;
        
      case 'lowercase':
        return typeof data === 'string' ? data.toLowerCase() : data;
        
      case 'trim':
        return typeof data === 'string' ? data.trim() : data;
        
      case 'parse':
        try {
          return typeof data === 'string' ? JSON.parse(data) : data;
        } catch {
          return data;
        }
        
      case 'stringify':
        return typeof data === 'object' ? JSON.stringify(data) : String(data);
        
      case 'replace':
        if (typeof data === 'string' && config.search && config.replace) {
          return data.replace(new RegExp(config.search, 'g'), config.replace);
        }
        return data;
        
      default:
        return data;
    }
  }

  private enrichData(data: any, config: any, event: StreamEvent): any {
    const enriched = { ...data };
    
    if (config.metadata) {
      enriched.metadata = {
        ...enriched.metadata,
        ...config.metadata
      };
    }
    
    if (config.timestamp) {
      enriched.metadata = {
        ...enriched.metadata,
        processedAt: new Date().toISOString()
      };
    }
    
    if (config.source) {
      enriched.metadata = {
        ...enriched.metadata,
        source: event.source
      };
    }
    
    return enriched;
  }

  private aggregateData(data: any, config: any): any {
    // Simple aggregation for now
    if (Array.isArray(data)) {
      switch (config.operation) {
        case 'sum':
          return data.reduce((sum, item) => sum + (Number(item) || 0), 0);
        case 'avg':
          const sum = data.reduce((sum, item) => sum + (Number(item) || 0), 0);
          return data.length > 0 ? sum / data.length : 0;
        case 'min':
          return Math.min(...data.map(item => Number(item) || Infinity));
        case 'max':
          return Math.max(...data.map(item => Number(item) || -Infinity));
        case 'count':
          return data.length;
        default:
          return data;
      }
    }
    return data;
  }

  private validateData(data: any, config: any): any {
    // Simple validation for now
    if (config.required && !data) {
      throw new Error('Required data is missing');
    }
    
    if (config.type && typeof data !== config.type) {
      throw new Error(`Expected type ${config.type}, got ${typeof data}`);
    }
    
    if (config.min !== undefined && data < config.min) {
      throw new Error(`Value ${data} is below minimum ${config.min}`);
    }
    
    if (config.max !== undefined && data > config.max) {
      throw new Error(`Value ${data} is above maximum ${config.max}`);
    }
    
    return data;
  }

  private matchesTopicPattern(topic: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\+/g, '[^/]+')
      .replace(/#/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(topic);
  }

  private matchesDataFilter(data: any, condition: any): boolean {
    if (!condition) return true;
    
    switch (condition.type) {
      case 'contains':
        return String(data).includes(condition.value);
      case 'regex':
        const regex = new RegExp(condition.value);
        return regex.test(String(data));
      case 'equals':
        return data === condition.value;
      case 'greater':
        return Number(data) > condition.value;
      case 'less':
        return Number(data) < condition.value;
      case 'custom':
        return condition.validator ? condition.validator(data) : true;
      default:
        return true;
    }
  }

  private matchesTimestampFilter(timestamp: Date, condition: any): boolean {
    if (!condition) return true;
    
    const time = timestamp.getTime();
    
    if (condition.after && time < condition.after.getTime()) {
      return false;
    }
    
    if (condition.before && time > condition.before.getTime()) {
      return false;
    }
    
    return true;
  }

  private matchesQualityFilter(quality: DataQualityMetrics, condition: any): boolean {
    if (!condition) return true;
    
    if (condition.minCompleteness && quality.completeness < condition.minCompleteness) {
      return false;
    }
    
    if (condition.minAccuracy && quality.accuracy < condition.minAccuracy) {
      return false;
    }
    
    if (condition.minTimeliness && quality.timeliness < condition.minTimeliness) {
      return false;
    }
    
    return true;
  }

  private checkForAlerts(event: StreamEvent, processedData: any): Alert[] {
    const alerts: Alert[] = [];
    
    // Check for data quality alerts
    if (event.quality.completeness < 80) {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'warning',
        message: `Low data completeness: ${event.quality.completeness}%`,
        timestamp: new Date(),
        source: event.source,
        metadata: { quality: event.quality }
      });
    }
    
    // Check for processing time alerts
    if (event.quality.timeliness < 90) {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'warning',
        message: `Low data timeliness: ${event.quality.timeliness}%`,
        timestamp: new Date(),
        source: event.source,
        metadata: { quality: event.quality }
      });
    }
    
    // Emit alerts
    alerts.forEach(alert => {
      globalEventBus.publish('streaming.alert.raised', alert);
    });
    
    this.metrics.alertCount += alerts.length;
    
    return alerts;
  }

  private enrichEventData(event: StreamEvent, processedData: any): Record<string, any> {
    return {
      originalSource: event.source,
      processingTimestamp: new Date().toISOString(),
      dataSize: JSON.stringify(processedData).length,
      qualityScore: (event.quality.completeness + event.quality.accuracy + event.quality.timeliness) / 3
    };
  }

  private updateProcessingMetrics(processingTime: number): void {
    if (this.metrics.averageProcessingTime === 0) {
      this.metrics.averageProcessingTime = processingTime;
    } else {
      // Exponential moving average
      this.metrics.averageProcessingTime = 
        this.metrics.averageProcessingTime * 0.9 + processingTime * 0.1;
    }
  }

  private processEventBuffer(): void {
    if (this.eventBuffer.length === 0) return;
    
    const batch = this.eventBuffer.splice(0, this.config.batchSize);
    this.processBatch(batch).catch(error => {
      console.error('Error processing event batch:', error);
    });
  }

  private startMetricsCollection(): void {
    // Update throughput every second
    setInterval(() => {
      if (this.metrics.lastProcessed) {
        const now = new Date();
        const timeDiff = (now.getTime() - this.metrics.lastProcessed.getTime()) / 1000;
        
        if (timeDiff > 0) {
          this.metrics.throughput = this.metrics.processedEvents / timeDiff;
        }
      }
    }, 1000);
  }
}

// Export default instance
export const globalStreamProcessor = new StreamProcessor();
export default globalStreamProcessor;
