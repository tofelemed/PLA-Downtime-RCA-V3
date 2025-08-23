// Event Stream Processor - Core real-time data flow engine
// This can be easily replaced with backend services later

import { globalEventBus } from '../events/EventBus';
import { StreamProcessor } from './StreamProcessor';
import { IConnector, ConnectionConfig, StreamConfig, DataQualityMetrics } from '../integrations/base/IConnector';
import { globalUniversalConnectorService } from '../storage/UniversalConnectorService';

export interface DataSource {
  id: string;
  name: string;
  connector: IConnector;
  config: StreamConfig;
  enabled: boolean;
  lastData?: any;
  lastUpdate?: Date;
  errorCount: number;
  status: 'active' | 'inactive' | 'error' | 'connecting';
}

export interface DataSink {
  id: string;
  name: string;
  type: 'database' | 'api' | 'file' | 'event_bus' | 'websocket' | 'mqtt';
  config: Record<string, any>;
  enabled: boolean;
  lastWrite?: Date;
  writeCount: number;
  errorCount: number;
}

export interface StreamProcessor {
  id: string;
  name: string;
  type: 'transform' | 'filter' | 'aggregate' | 'correlate' | 'enrich';
  config: Record<string, any>;
  enabled: boolean;
  order: number;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
}

export interface StreamMetrics {
  totalEvents: number;
  processedEvents: number;
  droppedEvents: number;
  averageLatency: number;
  throughput: number; // events per second
  activeSources: number;
  activeSinks: number;
  activeProcessors: number;
  lastEventTime?: Date;
  errorRate: number;
  dataQuality: DataQualityMetrics;
}

export interface StreamAlert {
  id: string;
  type: 'warning' | 'error' | 'critical' | 'info';
  message: string;
  timestamp: Date;
  source: string;
  severity: number; // 1-10
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

export class EventStreamProcessor {
  private sources: Map<string, DataSource> = new Map();
  private sinks: Map<string, DataSink> = new Map();
  private processors: Map<string, StreamProcessor> = new Map();
  private streamProcessor: StreamProcessor;
  private metrics: StreamMetrics;
  private alerts: Map<string, StreamAlert> = new Map();
  private isRunning: boolean = false;
  private processingQueue: any[] = [];
  private processingInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.streamProcessor = new StreamProcessor({
      enableTransforms: true,
      enableFilters: true,
      enableAlerts: true,
      enableMetrics: true,
      maxProcessingTime: 500,
      bufferSize: 50000,
      batchSize: 100,
      retryAttempts: 3
    });

    this.metrics = {
      totalEvents: 0,
      processedEvents: 0,
      droppedEvents: 0,
      averageLatency: 0,
      throughput: 0,
      activeSources: 0,
      activeSinks: 0,
      activeProcessors: 0,
      errorRate: 0,
      dataQuality: {
        completeness: 100,
        accuracy: 100,
        timeliness: 100,
        validity: 100,
        consistency: 100,
        lastUpdated: new Date()
      }
    };

    this.setupEventHandlers();
    this.startHealthCheck();
    this.initializeStorage();
  }

  // Initialize storage and load existing data
  private async initializeStorage(): Promise<void> {
    try {
      await globalUniversalConnectorService.initialize();
      
      // Load existing data from storage
      await this.loadDataFromStorage();
      
      console.log('EventStreamProcessor storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  // Load existing data from storage
  private async loadDataFromStorage(): Promise<void> {
    try {
      // Load data sources
      const storedSources = await globalUniversalConnectorService.getAllDataSources();
      for (const storedSource of storedSources) {
        // Convert stored data to runtime format
        const source: DataSource = {
          id: storedSource.id,
          name: storedSource.name,
          connector: this.createConnectorFromStorage(storedSource),
          config: storedSource.config,
          enabled: storedSource.enabled,
          lastData: storedSource.lastData,
          lastUpdate: storedSource.lastUpdate,
          errorCount: storedSource.errorCount,
          status: storedSource.status
        };
        this.sources.set(source.id, source);
      }

      // Load data sinks
      const storedSinks = await globalUniversalConnectorService.getAllDataSinks();
      for (const storedSink of storedSinks) {
        const sink: DataSink = {
          id: storedSink.id,
          name: storedSink.name,
          type: storedSink.type as any,
          config: storedSink.config,
          enabled: storedSink.enabled,
          lastWrite: storedSink.lastWrite,
          writeCount: storedSink.writeCount,
          errorCount: storedSink.errorCount
        };
        this.sinks.set(sink.id, sink);
      }

      // Load stream processors
      const storedProcessors = await globalUniversalConnectorService.getAllStreamProcessors();
      for (const storedProcessor of storedProcessors) {
        const processor: StreamProcessor = {
          id: storedProcessor.id,
          name: storedProcessor.name,
          type: storedProcessor.type as any,
          config: storedProcessor.config,
          enabled: storedProcessor.enabled,
          order: storedProcessor.order,
          inputSchema: storedProcessor.inputSchema,
          outputSchema: storedProcessor.outputSchema
        };
        this.processors.set(processor.id, processor);
      }

      // Load alerts
      const storedAlerts = await globalUniversalConnectorService.getAllStreamAlerts();
      for (const storedAlert of storedAlerts) {
        const alert: StreamAlert = {
          id: storedAlert.id,
          type: storedAlert.type,
          message: storedAlert.message,
          timestamp: storedAlert.timestamp,
          source: storedAlert.source,
          severity: storedAlert.severity,
          acknowledged: storedAlert.acknowledged,
          metadata: storedAlert.metadata
        };
        this.alerts.set(alert.id, alert);
      }

      // Update metrics
      this.updateMetrics();
      
    } catch (error) {
      console.error('Failed to load data from storage:', error);
    }
  }

  // Create connector from stored data
  private createConnectorFromStorage(storedSource: any): IConnector {
    // This is a simplified implementation
    // In production, you'd implement proper connector reconstruction
    return {
      isConnected: () => false,
      connect: async () => {},
      disconnect: async () => {},
      subscribe: async () => {},
      unsubscribe: async () => {},
      getHealth: async () => ({ status: 'unknown' }),
      emitEvent: () => {}
    } as IConnector;
  }

  // Add a data source
  async addSource(source: DataSource): Promise<void> {
    if (this.sources.has(source.id)) {
      throw new Error(`Source with ID ${source.id} already exists`);
    }

    this.sources.set(source.id, source);
    this.updateMetrics();
    
    // Subscribe to source events if enabled
    if (source.enabled && source.config.realTime) {
      this.subscribeToSource(source);
    }

    // Persist to storage
    await this.persistDataSource(source);

    globalEventBus.publish('stream.source.added', { source });
  }

  // Persist data source to storage
  private async persistDataSource(source: DataSource): Promise<void> {
    try {
      const sourceStorage = {
        id: source.id,
        name: source.name,
        connectorType: source.connector.constructor.name,
        config: source.config,
        enabled: source.enabled,
        lastData: source.lastData,
        lastUpdate: source.lastUpdate,
        errorCount: source.errorCount,
        status: source.status,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await globalUniversalConnectorService.saveDataSource(sourceStorage);
    } catch (error) {
      console.error('Failed to persist data source:', error);
    }
  }

  // Add a data sink
  async addSink(sink: DataSink): Promise<void> {
    if (this.sinks.has(sink.id)) {
      throw new Error(`Sink with ID ${sink.id} already exists`);
    }

    this.sinks.set(sink.id, sink);
    this.updateMetrics();
    
    // Persist to storage
    await this.persistDataSink(sink);

    globalEventBus.publish('stream.sink.added', { sink });
  }

  // Persist data sink to storage
  private async persistDataSink(sink: DataSink): Promise<void> {
    try {
      const sinkStorage = {
        id: sink.id,
        name: sink.name,
        type: sink.type,
        config: sink.config,
        enabled: sink.enabled,
        lastWrite: sink.lastWrite,
        writeCount: sink.writeCount,
        errorCount: sink.errorCount,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await globalUniversalConnectorService.saveDataSink(sinkStorage);
    } catch (error) {
      console.error('Failed to persist data sink:', error);
    }
  }

  // Add a stream processor
  async addProcessor(processor: StreamProcessor): Promise<void> {
    if (this.processors.has(processor.id)) {
      throw new Error(`Processor with ID ${processor.id} already exists`);
    }

    this.processors.set(processor.id, processor);
    this.updateMetrics();
    
    // Persist to storage
    await this.persistStreamProcessor(processor);

    globalEventBus.publish('stream.processor.added', { processor });
  }

  // Persist stream processor to storage
  private async persistStreamProcessor(processor: StreamProcessor): Promise<void> {
    try {
      const processorStorage = {
        id: processor.id,
        name: processor.name,
        type: processor.type,
        config: processor.config,
        enabled: processor.enabled,
        order: processor.order,
        inputSchema: processor.inputSchema,
        outputSchema: processor.outputSchema,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await globalUniversalConnectorService.saveStreamProcessor(processorStorage);
    } catch (error) {
      console.error('Failed to persist stream processor:', error);
    }
  }

  // Start the stream processor
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Stream processor is already running');
    }

    try {
      // Connect all enabled sources
      for (const source of this.sources.values()) {
        if (source.enabled) {
          await this.connectSource(source);
        }
      }

      // Initialize all enabled sinks
      for (const sink of this.sinks.values()) {
        if (sink.enabled) {
          await this.initializeSink(sink);
        }
      }

      // Start processing
      this.isRunning = true;
      this.startProcessing();
      
      globalEventBus.publish('stream.started', { timestamp: new Date() });
      
          } catch (error) {
        await this.createAlert('error', `Failed to start stream processor: ${error}`, 'system');
        throw error;
      }
  }

  // Stop the stream processor
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop processing
      this.isRunning = false;
      this.stopProcessing();

      // Disconnect all sources
      for (const source of this.sources.values()) {
        if (source.connector.isConnected()) {
          await source.connector.disconnect();
        }
      }

      globalEventBus.publish('stream.stopped', { timestamp: new Date() });
      
          } catch (error) {
        await this.createAlert('error', `Failed to stop stream processor: ${error}`, 'system');
        throw error;
      }
  }

  // Get current metrics
  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }

  // Persist metrics to storage
  private async persistMetrics(): Promise<void> {
    try {
      const metricsStorage = {
        id: `metrics_${Date.now()}`,
        timestamp: new Date(),
        totalEvents: this.metrics.totalEvents,
        processedEvents: this.metrics.processedEvents,
        droppedEvents: this.metrics.droppedEvents,
        averageLatency: this.metrics.averageLatency,
        throughput: this.metrics.throughput,
        activeSources: this.metrics.activeSources,
        activeSinks: this.metrics.activeSinks,
        activeProcessors: this.metrics.activeProcessors,
        errorRate: this.metrics.errorRate,
        dataQuality: this.metrics.dataQuality
      };

      await globalUniversalConnectorService.saveStreamMetrics(metricsStorage);
    } catch (error) {
      console.error('Failed to persist metrics:', error);
    }
  }

  // Get all alerts
  getAlerts(): StreamAlert[] {
    return Array.from(this.alerts.values());
  }

  // Acknowledge an alert
  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.alerts.set(alertId, alert);
      
      // Persist alert changes to storage
      await this.persistStreamAlert(alert);
      
      globalEventBus.publish('stream.alert.acknowledged', { alertId });
    }
  }

  // Persist stream alert to storage
  private async persistStreamAlert(alert: StreamAlert): Promise<void> {
    try {
      const alertStorage = {
        id: alert.id,
        type: alert.type,
        message: alert.message,
        timestamp: alert.timestamp,
        source: alert.source,
        severity: alert.severity,
        acknowledged: alert.acknowledged,
        metadata: alert.metadata || {},
        createdAt: alert.timestamp, // Use timestamp as creation date
        updatedAt: new Date()
      };

      await globalUniversalConnectorService.saveStreamAlert(alertStorage);
    } catch (error) {
      console.error('Failed to persist stream alert:', error);
    }
  }

  // Get source status
  getSourceStatus(sourceId: string): DataSource | undefined {
    return this.sources.get(sourceId);
  }

  // Get all sources
  getAllSources(): DataSource[] {
    return Array.from(this.sources.values());
  }

  // Get sink status
  getSinkStatus(sinkId: string): DataSink | undefined {
    return this.sinks.get(sinkId);
  }

  // Get all sinks
  getAllSinks(): DataSink[] {
    return Array.from(this.sinks.values());
  }

  // Enable/disable a source
  async setSourceEnabled(sourceId: string, enabled: boolean): Promise<void> {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    source.enabled = enabled;
    
    if (enabled && this.isRunning) {
      await this.connectSource(source);
    } else if (!enabled && source.connector.isConnected()) {
      await source.connector.disconnect();
    }

    // Persist changes to storage
    await this.persistDataSource(source);

    this.updateMetrics();
    globalEventBus.publish('stream.source.updated', { sourceId, enabled });
  }

  // Enable/disable a sink
  async setSinkEnabled(sinkId: string, enabled: boolean): Promise<void> {
    const sink = this.sinks.get(sinkId);
    if (!sink) {
      throw new Error(`Sink ${sinkId} not found`);
    }

    sink.enabled = enabled;
    
    if (enabled && this.isRunning) {
      await this.initializeSink(sink);
    }

    // Persist changes to storage
    await this.persistDataSink(sink);

    this.updateMetrics();
    globalEventBus.publish('stream.sink.updated', { sinkId, enabled });
  }

  // Private methods

  private async connectSource(source: DataSource): Promise<void> {
    try {
      source.status = 'connecting';
      
      if (!source.connector.isConnected()) {
        await source.connector.connect();
      }

      if (source.config.realTime) {
        await this.subscribeToSource(source);
      }

      source.status = 'active';
      source.errorCount = 0;
      
          } catch (error) {
        source.status = 'error';
        source.errorCount++;
        await this.createAlert('error', `Failed to connect source ${source.name}: ${error}`, source.id);
        throw error;
      }
  }

  private async subscribeToSource(source: DataSource): Promise<void> {
    if (!source.config.topics || source.config.topics.length === 0) {
      return;
    }

    for (const topic of source.config.topics) {
      try {
        await source.connector.subscribe(topic, (data) => {
          this.processSourceData(source, topic, data);
        });
              } catch (error) {
          await this.createAlert('warning', `Failed to subscribe to topic ${topic} on source ${source.name}`, source.id);
        }
    }
  }

  private async initializeSink(sink: DataSink): Promise<void> {
    try {
      // Initialize sink based on type
      switch (sink.type) {
        case 'event_bus':
          // Event bus is already available
          break;
        case 'websocket':
          // Initialize WebSocket connection
          break;
        case 'mqtt':
          // Initialize MQTT connection
          break;
        case 'database':
          // Initialize database connection
          break;
        case 'api':
          // Test API endpoint
          break;
        case 'file':
          // Ensure file path exists
          break;
      }
      
      sink.errorCount = 0;
      
          } catch (error) {
        sink.errorCount++;
        await this.createAlert('error', `Failed to initialize sink ${sink.name}: ${error}`, sink.id);
        throw error;
      }
  }

  private processSourceData(source: DataSource, topic: string, data: any): void {
    if (!this.isRunning) {
      return;
    }

    const event = {
      id: `${source.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      source: source.id,
      topic,
      data,
      metadata: {
        sourceName: source.name,
        topic,
        originalData: data
      }
    };

    // Add to processing queue
    this.processingQueue.push(event);
    
    // Update source status
    source.lastData = data;
    source.lastUpdate = new Date();
    
    // Update metrics
    this.metrics.totalEvents++;
    this.updateThroughput();
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processBatch();
    }, 100); // Process every 100ms
  }

  private stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  private async processBatch(): Promise<void> {
    if (this.processingQueue.length === 0) {
      return;
    }

    const batch = this.processingQueue.splice(0, Math.min(this.processingQueue.length, 100));
    const startTime = Date.now();

    for (const event of batch) {
      try {
        // Apply processors in order
        let processedData = event.data;
        const appliedProcessors: string[] = [];

        for (const processor of Array.from(this.processors.values())
          .filter(p => p.enabled)
          .sort((a, b) => a.order - b.order)) {
          
          processedData = await this.applyProcessor(processor, processedData, event);
          appliedProcessors.push(processor.id);
        }

        // Send to sinks
        await this.sendToSinks(processedData, event);

        // Update metrics
        this.metrics.processedEvents++;
        const processingTime = Date.now() - startTime;
        this.updateAverageLatency(processingTime);

              } catch (error) {
          this.metrics.droppedEvents++;
          await this.createAlert('warning', `Failed to process event: ${error}`, event.source);
        }
    }
  }

  private async applyProcessor(processor: StreamProcessor, data: any, event: any): Promise<any> {
    try {
      switch (processor.type) {
        case 'transform':
          return await this.applyTransform(processor, data, event);
        case 'filter':
          return await this.applyFilter(processor, data, event);
        case 'aggregate':
          return await this.applyAggregate(processor, data, event);
        case 'correlate':
          return await this.applyCorrelate(processor, data, event);
        case 'enrich':
          return await this.applyEnrich(processor, data, event);
        default:
          return data;
      }
            } catch (error) {
          await this.createAlert('warning', `Processor ${processor.name} failed: ${error}`, event.source);
          return data; // Return original data if processor fails
        }
  }

  private async applyTransform(processor: StreamProcessor, data: any, event: any): Promise<any> {
    // Apply transformation based on processor config
    const { operation, field, value, expression } = processor.config;
    
    switch (operation) {
      case 'rename':
        return this.renameField(data, field, value);
      case 'calculate':
        return this.calculateField(data, field, expression);
      case 'format':
        return this.formatField(data, field, value);
      case 'extract':
        return this.extractField(data, field);
      default:
        return data;
    }
  }

  private async applyFilter(processor: StreamProcessor, data: any, event: any): Promise<any> {
    const { condition, field, operator, value } = processor.config;
    
    if (this.evaluateCondition(data, condition, field, operator, value)) {
      return data;
    }
    
    return null; // Filter out this data
  }

  private async applyAggregate(processor: StreamProcessor, data: any, event: any): Promise<any> {
    // Implement aggregation logic
    return data;
  }

  private async applyCorrelate(processor: StreamProcessor, data: any, event: any): Promise<any> {
    // Implement correlation logic
    return data;
  }

  private async applyEnrich(processor: StreamProcessor, data: any, event: any): Promise<any> {
    // Implement enrichment logic
    return data;
  }

  // Helper methods for transformations
  private renameField(data: any, oldField: string, newField: string): any {
    if (typeof data === 'object' && data !== null) {
      const newData = { ...data };
      if (newData[oldField] !== undefined) {
        newData[newField] = newData[oldField];
        delete newData[oldField];
      }
      return newData;
    }
    return data;
  }

  private calculateField(data: any, field: string, expression: string): any {
    if (typeof data === 'object' && data !== null) {
      try {
        // Simple expression evaluation (in production, use a proper expression parser)
        const newData = { ...data };
        newData[field] = eval(expression.replace(/\$field/g, `data.${field}`));
        return newData;
      } catch (error) {
        return data;
      }
    }
    return data;
  }

  private formatField(data: any, field: string, format: string): any {
    if (typeof data === 'object' && data !== null) {
      const newData = { ...data };
      if (newData[field] !== undefined) {
        // Apply formatting based on format string
        switch (format) {
          case 'uppercase':
            newData[field] = String(newData[field]).toUpperCase();
            break;
          case 'lowercase':
            newData[field] = String(newData[field]).toLowerCase();
            break;
          case 'number':
            newData[field] = Number(newData[field]);
            break;
          case 'date':
            newData[field] = new Date(newData[field]);
            break;
        }
      }
      return newData;
    }
    return data;
  }

  private extractField(data: any, field: string): any {
    if (typeof data === 'object' && data !== null) {
      return data[field];
    }
    return data;
  }

  private evaluateCondition(data: any, condition: string, field: string, operator: string, value: any): boolean {
    if (typeof data === 'object' && data !== null) {
      const fieldValue = data[field];
      
      switch (operator) {
        case 'equals':
          return fieldValue === value;
        case 'not_equals':
          return fieldValue !== value;
        case 'greater_than':
          return fieldValue > value;
        case 'less_than':
          return fieldValue < value;
        case 'contains':
          return String(fieldValue).includes(String(value));
        case 'regex':
          return new RegExp(value).test(String(fieldValue));
        default:
          return true;
      }
    }
    return false;
  }

  private async sendToSinks(data: any, event: any): Promise<void> {
    for (const sink of this.sinks.values()) {
      if (!sink.enabled) {
        continue;
      }

      try {
        switch (sink.type) {
          case 'event_bus':
            globalEventBus.publish(`sink.${sink.id}`, { data, event });
            break;
          case 'websocket':
            // Send via WebSocket
            break;
          case 'mqtt':
            // Send via MQTT
            break;
          case 'database':
            // Write to database
            break;
          case 'api':
            // Send via API
            break;
          case 'file':
            // Write to file
            break;
        }

        sink.writeCount++;
        sink.lastWrite = new Date();
        
              } catch (error) {
          sink.errorCount++;
          await this.createAlert('warning', `Failed to send to sink ${sink.name}: ${error}`, sink.id);
        }
    }
  }

  private async createAlert(type: 'warning' | 'error' | 'critical' | 'info', message: string, source: string): Promise<void> {
    const alert: StreamAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
      source,
      severity: type === 'critical' ? 10 : type === 'error' ? 7 : type === 'warning' ? 4 : 1,
      acknowledged: false,
      metadata: {
        sourceType: 'stream_processor'
      }
    };

    this.alerts.set(alert.id, alert);
    
    // Persist alert to storage
    await this.persistStreamAlert(alert);
    
    globalEventBus.publish('stream.alert.created', { alert });
  }

  private setupEventHandlers(): void {
    globalEventBus.subscribe('stream.source.enabled', (event) => {
      const { sourceId, enabled } = event.data;
      this.setSourceEnabled(sourceId, enabled);
    });

    globalEventBus.subscribe('stream.sink.enabled', (event) => {
      const { sinkId, enabled } = event.data;
      this.setSinkEnabled(sinkId, enabled);
    });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  private async performHealthCheck(): Promise<void> {
    // Check source health
    for (const source of this.sources.values()) {
      if (source.enabled && source.connector.isConnected()) {
        try {
          const health = await source.connector.getHealth();
          if (health.status !== 'healthy') {
            await this.createAlert('warning', `Source ${source.name} health check failed`, source.id);
          }
        } catch (error) {
          source.status = 'error';
          await this.createAlert('error', `Source ${source.name} health check error: ${error}`, source.id);
        }
      }
    }

    // Check sink health
    for (const sink of this.sinks.values()) {
      if (sink.enabled && sink.errorCount > 10) {
        await this.createAlert('warning', `Sink ${sink.name} has high error count: ${sink.errorCount}`, sink.id);
      }
    }

    // Update data quality metrics
    this.updateDataQualityMetrics();
  }

  private async updateMetrics(): Promise<void> {
    this.metrics.activeSources = Array.from(this.sources.values()).filter(s => s.enabled).length;
    this.metrics.activeSinks = Array.from(this.sinks.values()).filter(s => s.enabled).length;
    this.metrics.activeProcessors = Array.from(this.processors.values()).filter(p => p.enabled).length;
    
    // Persist metrics to storage periodically
    await this.persistMetrics();
  }

  private updateThroughput(): void {
    const now = Date.now();
    if (this.metrics.lastEventTime) {
      const timeDiff = (now - this.metrics.lastEventTime.getTime()) / 1000;
      if (timeDiff > 0) {
        this.metrics.throughput = this.metrics.totalEvents / timeDiff;
      }
    }
    this.metrics.lastEventTime = new Date(now);
  }

  private updateAverageLatency(processingTime: number): void {
    if (this.metrics.processedEvents > 0) {
      this.metrics.averageLatency = 
        (this.metrics.averageLatency * (this.metrics.processedEvents - 1) + processingTime) / 
        this.metrics.processedEvents;
    } else {
      this.metrics.averageLatency = processingTime;
    }
  }

  private updateDataQualityMetrics(): void {
    // Calculate data quality based on various factors
    let completeness = 100;
    let accuracy = 100;
    let timeliness = 100;
    let validity = 100;
    let consistency = 100;

    // Adjust based on error rates and processing success
    if (this.metrics.totalEvents > 0) {
      completeness = ((this.metrics.totalEvents - this.metrics.droppedEvents) / this.metrics.totalEvents) * 100;
      accuracy = Math.max(0, 100 - this.metrics.errorRate);
    }

    this.metrics.dataQuality = {
      completeness,
      accuracy,
      timeliness,
      validity,
      consistency,
      lastUpdated: new Date()
    };
  }

  // Cleanup
  destroy(): void {
    this.stop();
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.sources.clear();
    this.sinks.clear();
    this.processors.clear();
    this.alerts.clear();
  }
}

// Global instance
export const globalStreamProcessor = new EventStreamProcessor();
