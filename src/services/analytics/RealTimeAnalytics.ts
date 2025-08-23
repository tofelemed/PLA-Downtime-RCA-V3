import { globalEventBus } from '@/services/events/EventBus';

// Backend-ready interfaces
export interface IRealTimeAnalytics {
  addMetric(metric: MetricDefinition): Promise<void>;
  updateMetric(name: string, value: number, timestamp?: Date): Promise<void>;
  getMetrics(): Promise<MetricResult[]>;
  getMetric(name: string): Promise<MetricResult | null>;
  getAlerts(): Promise<Alert[]>;
  createAlert(alert: AlertDefinition): Promise<void>;
  acknowledgeAlert(alertId: string): Promise<void>;
  getAnalytics(): Promise<AnalyticsSummary>;
  exportData(format: ExportFormat): Promise<string>;
}

export interface MetricDefinition {
  id: string;
  name: string;
  description?: string;
  unit?: string;
  type: MetricType;
  category: string;
  tags?: string[];
  thresholds?: ThresholdConfig;
  aggregation?: AggregationConfig;
  retention?: RetentionConfig;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MetricType = 
  | 'counter'
  | 'gauge'
  | 'histogram'
  | 'summary'
  | 'custom';

export interface ThresholdConfig {
  warning?: number;
  critical?: number;
  min?: number;
  max?: number;
  direction: 'above' | 'below' | 'both';
}

export interface AggregationConfig {
  window: number; // seconds
  functions: AggregationFunction[];
  groupBy?: string[];
}

export type AggregationFunction = 
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'stddev'
  | 'percentile';

export interface RetentionConfig {
  rawData: number; // days
  aggregatedData: number; // days
  archiveAfter: number; // days
}

export interface MetricResult {
  id: string;
  name: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
  quality?: DataQuality;
}

export interface DataQuality {
  completeness: number; // 0-1
  accuracy: number; // 0-1
  timeliness: number; // 0-1
  validity: number; // 0-1
  consistency: number; // 0-1
}

export interface Alert {
  id: string;
  metricId: string;
  metricName: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  metadata?: Record<string, any>;
}

export type AlertType = 'threshold_exceeded' | 'data_quality' | 'anomaly' | 'custom';
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'error';

export interface AlertDefinition {
  metricId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: number;
  metadata?: Record<string, any>;
}

export interface AnalyticsSummary {
  totalMetrics: number;
  activeMetrics: number;
  totalAlerts: number;
  unacknowledgedAlerts: number;
  dataPoints: number;
  lastUpdate: Date;
  topMetrics: TopMetric[];
  alertTrends: AlertTrend[];
}

export interface TopMetric {
  name: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export interface AlertTrend {
  period: string;
  count: number;
  severity: AlertSeverity;
}

export type ExportFormat = 'json' | 'csv' | 'xml';

// IndexedDB Storage Service
class AnalyticsStorageService {
  private dbName = 'RealTimeAnalyticsDB';
  private dbVersion = 1;
  private stores = {
    metrics: 'metrics',
    metricData: 'metric_data',
    alerts: 'alerts',
    definitions: 'metric_definitions'
  };

  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Metrics definitions store
        if (!db.objectStoreNames.contains(this.stores.definitions)) {
          const store = db.createObjectStore(this.stores.definitions, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: true });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('enabled', 'enabled', { unique: false });
        }
        
        // Metric data store
        if (!db.objectStoreNames.contains(this.stores.metricData)) {
          const store = db.createObjectStore(this.stores.metricData, { keyPath: 'id' });
          store.createIndex('metricId', 'metricId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('metricId_timestamp', ['metricId', 'timestamp'], { unique: false });
        }
        
        // Alerts store
        if (!db.objectStoreNames.contains(this.stores.alerts)) {
          const store = db.createObjectStore(this.stores.alerts, { keyPath: 'id' });
          store.createIndex('metricId', 'metricId', { unique: false });
          store.createIndex('severity', 'severity', { unique: false });
          store.createIndex('acknowledged', 'acknowledged', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveMetricDefinition(definition: MetricDefinition): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.definitions], 'readwrite');
      const store = transaction.objectStore(this.stores.definitions);
      const request = store.put(definition);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMetricDefinition(metricId: string): Promise<MetricDefinition | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.definitions], 'readonly');
      const store = transaction.objectStore(this.stores.definitions);
      const request = store.get(metricId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllMetricDefinitions(): Promise<MetricDefinition[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.definitions], 'readonly');
      const store = transaction.objectStore(this.stores.definitions);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMetricData(data: MetricResult): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.metricData], 'readwrite');
      const store = transaction.objectStore(this.stores.metricData);
      const request = store.put(data);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMetricData(metricId: string, startTime?: Date, endTime?: Date): Promise<MetricResult[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.metricData], 'readonly');
      const store = transaction.objectStore(this.stores.metricData);
      const index = store.index('metricId_timestamp');
      
      let range: IDBKeyRange | undefined;
      if (startTime && endTime) {
        range = IDBKeyRange.bound([metricId, startTime], [metricId, endTime]);
      } else if (startTime) {
        range = IDBKeyRange.lowerBound([metricId, startTime]);
      } else if (endTime) {
        range = IDBKeyRange.upperBound([metricId, endTime]);
      }
      
      const request = range ? index.getAll(range) : index.getAll(IDBKeyRange.only(metricId));
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveAlert(alert: Alert): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.alerts], 'readwrite');
      const store = transaction.objectStore(this.stores.alerts);
      const request = store.put(alert);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAlerts(acknowledged?: boolean): Promise<Alert[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.alerts], 'readonly');
      const store = transaction.objectStore(this.stores.alerts);
      
      let request: IDBRequest;
      if (acknowledged !== undefined) {
        const index = store.index('acknowledged');
        request = index.getAll(acknowledged);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async updateAlert(alert: Alert): Promise<void> {
    return this.saveAlert(alert);
  }

  async cleanupOldData(retentionDays: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const db = await this.initDB();
    const transaction = db.transaction([this.stores.metricData], 'readwrite');
    const store = transaction.objectStore(this.stores.metricData);
    const index = store.index('timestamp');
    
    const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate));
    
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Aggregation Engine
class AggregationEngine {
  static aggregate(data: MetricResult[], config: AggregationConfig): Record<string, number> {
    const results: Record<string, number> = {};
    
    if (data.length === 0) return results;
    
    const values = data.map(d => d.value);
    
    config.functions.forEach(func => {
      switch (func) {
        case 'sum':
          results.sum = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          results.avg = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'min':
          results.min = Math.min(...values);
          break;
        case 'max':
          results.max = Math.max(...values);
          break;
        case 'count':
          results.count = values.length;
          break;
        case 'stddev':
          results.stddev = this.calculateStdDev(values);
          break;
        case 'percentile':
          results.percentile_95 = this.calculatePercentile(values, 95);
          results.percentile_99 = this.calculatePercentile(values, 99);
          break;
      }
    });
    
    return results;
  }

  private static calculateStdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private static calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

// Main Real-Time Analytics Implementation
export class RealTimeAnalytics implements IRealTimeAnalytics {
  private storage: AnalyticsStorageService;
  private eventBus: any;
  private metrics: Map<string, MetricDefinition> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private processingQueue: Array<{ metricId: string; value: number; timestamp: Date }> = [];
  private isProcessing: boolean = false;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(eventBus: any) {
    this.storage = new AnalyticsStorageService();
    this.eventBus = eventBus;
    
    this.initializeCleanup();
    this.loadMetricDefinitions();
  }

  async addMetric(metric: MetricDefinition): Promise<void> {
    // Validate metric
    if (!metric.name || !metric.type || !metric.category) {
      throw new Error('Invalid metric definition');
    }

    // Set timestamps
    metric.createdAt = new Date();
    metric.updatedAt = new Date();
    
    // Save to storage
    await this.storage.saveMetricDefinition(metric);
    
    // Add to memory cache
    this.metrics.set(metric.id, metric);
    
    // Create alert rules if thresholds are configured
    if (metric.thresholds) {
      await this.createAlertRules(metric);
    }
    
    // Publish event
    this.eventBus.publish('analytics:metric:added', { metric });
    
    // Emit to backend when available
    this.emitToBackend('analytics:metric:added', { metric });
  }

  async updateMetric(name: string, value: number, timestamp: Date = new Date()): Promise<void> {
    const metric = await this.getMetricByName(name);
    if (!metric) {
      throw new Error(`Metric '${name}' not found`);
    }

    // Create metric result
    const result: MetricResult = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: metric.name,
      value,
      timestamp,
      metadata: { source: 'realtime' },
      quality: this.calculateDataQuality(value, metric)
    };

    // Save to storage
    await this.storage.saveMetricData(result);
    
    // Check thresholds and create alerts
    await this.checkThresholds(metric, value, timestamp);
    
    // Queue for aggregation processing
    this.processingQueue.push({ metricId: metric.id, value, timestamp });
    
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    // Publish event
    this.eventBus.publish('analytics:metric:updated', { metric: result });
    
    // Emit to backend when available
    this.emitToBackend('analytics:metric:updated', { metric: result });
  }

  async getMetrics(): Promise<MetricResult[]> {
    const results: MetricResult[] = [];
    
    for (const metric of this.metrics.values()) {
      const data = await this.storage.getMetricData(metric.id, undefined, undefined);
      if (data.length > 0) {
        results.push(...data);
      }
    }
    
    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getMetric(name: string): Promise<MetricResult | null> {
    const metric = await this.getMetricByName(name);
    if (!metric) return null;
    
    const data = await this.storage.getMetricData(metric.id, undefined, undefined);
    return data.length > 0 ? data[data.length - 1] : null;
  }

  async getAlerts(): Promise<Alert[]> {
    return this.storage.getAlerts();
  }

  async createAlert(alertDef: AlertDefinition): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metricId: alertDef.metricId,
      metricName: alertDef.metricName,
      type: alertDef.type,
      severity: alertDef.severity,
      message: alertDef.message,
      value: alertDef.value,
      threshold: alertDef.threshold,
      timestamp: new Date(),
      acknowledged: false,
      metadata: alertDef.metadata
    };

    await this.storage.saveAlert(alert);
    
    // Publish event
    this.eventBus.publish('analytics:alert:created', { alert });
    
    // Emit to backend when available
    this.emitToBackend('analytics:alert:created', { alert });
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const alerts = await this.storage.getAlerts();
    const alert = alerts.find(a => a.id === alertId);
    
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = 'current_user'; // Will come from auth context
      
      await this.storage.updateAlert(alert);
      
      // Publish event
      this.eventBus.publish('analytics:alert:acknowledged', { alert });
      
      // Emit to backend when available
      this.emitToBackend('analytics:alert:acknowledged', { alert });
    }
  }

  async getAnalytics(): Promise<AnalyticsSummary> {
    const metrics = await this.getMetrics();
    const alerts = await this.getAlerts();
    const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
    
    // Calculate top metrics
    const topMetrics = await this.calculateTopMetrics();
    
    // Calculate alert trends
    const alertTrends = this.calculateAlertTrends(alerts);
    
    return {
      totalMetrics: this.metrics.size,
      activeMetrics: Array.from(this.metrics.values()).filter(m => m.enabled).length,
      totalAlerts: alerts.length,
      unacknowledgedAlerts: unacknowledgedAlerts.length,
      dataPoints: metrics.length,
      lastUpdate: new Date(),
      topMetrics,
      alertTrends
    };
  }

  async exportData(format: ExportFormat): Promise<string> {
    const data = await this.getMetrics();
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      case 'xml':
        return this.convertToXML(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private helper methods
  private async getMetricByName(name: string): Promise<MetricDefinition | null> {
    const definitions = await this.storage.getAllMetricDefinitions();
    return definitions.find(d => d.name === name) || null;
  }

  private async loadMetricDefinitions(): Promise<void> {
    const definitions = await this.storage.getAllMetricDefinitions();
    definitions.forEach(def => this.metrics.set(def.id, def));
  }

  private async createAlertRules(metric: MetricDefinition): Promise<void> {
    if (!metric.thresholds) return;
    
    const rule: AlertRule = {
      metricId: metric.id,
      thresholds: metric.thresholds,
      enabled: true
    };
    
    this.alertRules.set(metric.id, rule);
  }

  private async checkThresholds(metric: MetricDefinition, value: number, timestamp: Date): Promise<void> {
    const rule = this.alertRules.get(metric.id);
    if (!rule || !rule.enabled || !metric.thresholds) return;
    
    const { thresholds } = metric;
    let shouldAlert = false;
    let severity: AlertSeverity = 'info';
    let message = '';
    
    // Check thresholds
    if (thresholds.warning !== undefined) {
      if (thresholds.direction === 'above' && value > thresholds.warning) {
        shouldAlert = true;
        severity = 'warning';
        message = `Metric '${metric.name}' exceeded warning threshold: ${value} > ${thresholds.warning}`;
      } else if (thresholds.direction === 'below' && value < thresholds.warning) {
        shouldAlert = true;
        severity = 'warning';
        message = `Metric '${metric.name}' below warning threshold: ${value} < ${thresholds.warning}`;
      }
    }
    
    if (thresholds.critical !== undefined) {
      if (thresholds.direction === 'above' && value > thresholds.critical) {
        shouldAlert = true;
        severity = 'critical';
        message = `Metric '${metric.name}' exceeded critical threshold: ${value} > ${thresholds.critical}`;
      } else if (thresholds.direction === 'below' && value < thresholds.critical) {
        shouldAlert = true;
        severity = 'critical';
        message = `Metric '${metric.name}' below critical threshold: ${value} < ${thresholds.critical}`;
      }
    }
    
    if (shouldAlert) {
      await this.createAlert({
        metricId: metric.id,
        metricName: metric.name,
        type: 'threshold_exceeded',
        severity,
        message,
        value,
        threshold: thresholds.critical || thresholds.warning || 0
      });
    }
  }

  private calculateDataQuality(value: number, metric: MetricDefinition): DataQuality {
    // Simple quality calculation - in production, this would be more sophisticated
    return {
      completeness: 1.0,
      accuracy: 0.95,
      timeliness: 1.0,
      validity: this.isValidValue(value, metric) ? 1.0 : 0.5,
      consistency: 0.9
    };
  }

  private isValidValue(value: number, metric: MetricDefinition): boolean {
    if (!metric.thresholds) return true;
    
    const { min, max } = metric.thresholds;
    
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    
    return true;
  }

  private async calculateTopMetrics(): Promise<TopMetric[]> {
    const metrics = await this.getMetrics();
    const metricGroups = new Map<string, MetricResult[]>();
    
    // Group by metric name
    metrics.forEach(m => {
      if (!metricGroups.has(m.name)) {
        metricGroups.set(m.name, []);
      }
      metricGroups.get(m.name)!.push(m);
    });
    
    // Calculate top metrics
    const topMetrics: TopMetric[] = [];
    
    for (const [name, data] of metricGroups) {
      if (data.length < 2) continue;
      
      const sorted = data.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      const current = sorted[0].value;
      const previous = sorted[1].value;
      const change = ((current - previous) / previous) * 100;
      
      topMetrics.push({
        name,
        value: current,
        change,
        trend: change > 1 ? 'up' : change < -1 ? 'down' : 'stable'
      });
    }
    
    return topMetrics
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 10);
  }

  private calculateAlertTrends(alerts: Alert[]): AlertTrend[] {
    const now = new Date();
    const periods = [
      { name: '1h', hours: 1 },
      { name: '6h', hours: 6 },
      { name: '24h', hours: 24 },
      { name: '7d', hours: 168 }
    ];
    
    return periods.map(period => {
      const cutoff = new Date(now.getTime() - period.hours * 60 * 60 * 1000);
      const periodAlerts = alerts.filter(a => a.timestamp > cutoff);
      
      const critical = periodAlerts.filter(a => a.severity === 'critical').length;
      const warning = periodAlerts.filter(a => a.severity === 'warning').length;
      const error = periodAlerts.filter(a => a.severity === 'error').length;
      
      return {
        period: period.name,
        count: critical + warning + error,
        severity: critical > 0 ? 'critical' : warning > 0 ? 'warning' : 'info'
      };
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    
    while (this.processingQueue.length > 0) {
      const batch = this.processingQueue.splice(0, 50); // Process in batches of 50
      
      // Process aggregations
      for (const item of batch) {
        const metric = this.metrics.get(item.metricId);
        if (metric?.aggregation) {
          const data = await this.storage.getMetricData(
            item.metricId,
            new Date(item.timestamp.getTime() - metric.aggregation.window * 1000),
            item.timestamp
          );
          
          if (data.length > 0) {
            const aggregated = AggregationEngine.aggregate(data, metric.aggregation);
            // Store aggregated results or use them for further processing
            console.log(`Aggregated ${metric.name}:`, aggregated);
          }
        }
      }
    }
    
    this.isProcessing = false;
  }

  private initializeCleanup(): void {
    // Clean up old data every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.storage.cleanupOldData(30); // Keep 30 days of data
      } catch (error) {
        console.error('Data cleanup failed:', error);
      }
    }, 60 * 60 * 1000);
  }

  private convertToCSV(data: MetricResult[]): string {
    if (data.length === 0) return '';
    
    const headers = ['Name', 'Value', 'Timestamp', 'Quality'];
    const rows = data.map(d => [
      d.name,
      d.value,
      d.timestamp.toISOString(),
      d.quality ? Object.values(d.quality).join(',') : ''
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToXML(data: MetricResult[]): string {
    const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<metrics>'];
    
    data.forEach(d => {
      xml.push('  <metric>');
      xml.push(`    <name>${d.name}</name>`);
      xml.push(`    <value>${d.value}</value>`);
      xml.push(`    <timestamp>${d.timestamp.toISOString()}</timestamp>`);
      if (d.quality) {
        xml.push('    <quality>');
        Object.entries(d.quality).forEach(([key, value]) => {
          xml.push(`      <${key}>${value}</${key}>`);
        });
        xml.push('    </quality>');
      }
      xml.push('  </metric>');
    });
    
    xml.push('</metrics>');
    return xml.join('\n');
  }

  // Backend migration support
  private emitToBackend(event: string, data: any): void {
    // This will be replaced with actual backend API calls
    console.log(`[Backend] ${event}:`, data);
    
    // When backend is available, this will be:
    // await fetch('/api/analytics/events', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ event, data })
    // });
  }

  // Cleanup method for backend migration
  async migrateToBackend(): Promise<void> {
    const definitions = await this.storage.getAllMetricDefinitions();
    const metrics = await this.getMetrics();
    const alerts = await this.getAlerts();
    
    // Send all data to backend
    for (const def of definitions) {
      await this.emitToBackend('analytics:definition:migrate', { definition: def });
    }
    
    for (const metric of metrics) {
      await this.emitToBackend('analytics:metric:migrate', { metric });
    }
    
    for (const alert of alerts) {
      await this.emitToBackend('analytics:alert:migrate', { alert });
    }
    
    console.log('Analytics data migrated to backend');
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Alert rule interface
interface AlertRule {
  metricId: string;
  thresholds: ThresholdConfig;
  enabled: boolean;
}

// Export singleton instance
export const globalRealTimeAnalytics = new RealTimeAnalytics(globalEventBus);
