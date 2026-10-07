import { EventBus, globalEventBus } from '@/services/events/EventBus';

// Backend-ready interfaces
export interface IPerformanceMonitor {
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  addMetric(metric: PerformanceMetric): Promise<void>;
  recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void>;
  getMetrics(filters?: MetricFilters): Promise<PerformanceMetric[]>;
  getPerformanceSummary(): Promise<PerformanceSummary>;
  getSystemHealth(): Promise<SystemHealth>;
  exportPerformanceReport(format: ExportFormat): Promise<string>;
}

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  category: MetricCategory;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export type MetricCategory = 
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'network'
  | 'database'
  | 'api'
  | 'frontend'
  | 'custom';

export interface MetricFilters {
  category?: MetricCategory[];
  name?: string[];
  startTime?: Date;
  endTime?: Date;
  tags?: Record<string, string>;
}

export interface PerformanceSummary {
  timestamp: Date;
  totalMetrics: number;
  averageCPU: number;
  averageMemory: number;
  averageDisk: number;
  averageNetwork: number;
  topMetrics: TopMetric[];
  performanceTrends: PerformanceTrend[];
  alerts: PerformanceAlert[];
}

export interface TopMetric {
  name: string;
  value: number;
  change: number;
  trend: 'improving' | 'degrading' | 'stable';
  category: MetricCategory;
}

export interface PerformanceTrend {
  period: string;
  metric: string;
  averageValue: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export interface PerformanceAlert {
  id: string;
  metric: string;
  severity: 'warning' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  cpu: SystemComponentHealth;
  memory: SystemComponentHealth;
  disk: SystemComponentHealth;
  network: SystemComponentHealth;
  database: SystemComponentHealth;
  lastUpdated: Date;
}

export interface SystemComponentHealth {
  status: 'healthy' | 'warning' | 'critical';
  value: number;
  threshold: number;
  message: string;
}

export type ExportFormat = 'json' | 'csv' | 'xml';

// IndexedDB Storage Service
class PerformanceStorageService {
  private dbName = 'PerformanceMonitorDB';
  private dbVersion = 1;
  private stores = {
    metrics: 'performance_metrics',
    summary: 'performance_summary',
    health: 'system_health'
  };

  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.stores.metrics)) {
          const store = db.createObjectStore(this.stores.metrics, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('category_timestamp', ['category', 'timestamp'], { unique: false });
        }
        
        if (!db.objectStoreNames.contains(this.stores.summary)) {
          const store = db.createObjectStore(this.stores.summary, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(this.stores.health)) {
          const store = db.createObjectStore(this.stores.health, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveMetric(metric: PerformanceMetric): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.metrics], 'readwrite');
      const store = transaction.objectStore(this.stores.metrics);
      const request = store.put(metric);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMetrics(filters?: MetricFilters): Promise<PerformanceMetric[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.metrics], 'readonly');
      const store = transaction.objectStore(this.stores.metrics);
      
      let request: IDBRequest;
      
      if (filters?.category && filters.category.length > 0) {
        const category = filters.category[0]; // For simplicity, use first category
        const index = store.index('category_timestamp');
        const startTime = filters.startTime || new Date(0);
        const endTime = filters.endTime || new Date();
        const range = IDBKeyRange.bound([category, startTime], [category, endTime]);
        request = index.getAll(range);
      } else {
        const index = store.index('timestamp');
        const startTime = filters?.startTime || new Date(0);
        const endTime = filters?.endTime || new Date();
        const range = IDBKeyRange.bound(startTime, endTime);
        request = index.getAll(range);
      }
      
      request.onsuccess = () => {
        let metrics = request.result || [];
        
        // Apply additional filters in memory
        if (filters?.name && filters.name.length > 0) {
          metrics = metrics.filter(m => filters.name!.includes(m.name));
        }
        
        if (filters?.tags) {
          metrics = metrics.filter(m => {
            return Object.entries(filters.tags!).every(([key, value]) => 
              m.tags?.[key] === value
            );
          });
        }
        
        // Sort by timestamp (newest first)
        metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        resolve(metrics);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveSummary(summary: PerformanceSummary): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.summary], 'readwrite');
      const store = transaction.objectStore(this.stores.summary);
      const request = store.put(summary);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveHealth(health: SystemHealth): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.health], 'readwrite');
      const store = transaction.objectStore(this.stores.health);
      const request = store.put(health);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async cleanupOldData(retentionDays: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const db = await this.initDB();
    const transaction = db.transaction([this.stores.metrics, this.stores.summary, this.stores.health], 'readwrite');
    
    // Clean up old metrics
    const metricsStore = transaction.objectStore(this.stores.metrics);
    const metricsIndex = metricsStore.index('timestamp');
    const metricsRequest = metricsIndex.openCursor(IDBKeyRange.upperBound(cutoffDate));
    
    metricsRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    
    // Clean up old summaries (keep only last 100)
    const summaryStore = transaction.objectStore(this.stores.summary);
    const summaryIndex = summaryStore.index('timestamp');
    const summaryRequest = summaryIndex.getAll();
    
    summaryRequest.onsuccess = () => {
      const summaries = summaryRequest.result || [];
      if (summaries.length > 100) {
        const toDelete = summaries
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          .slice(0, summaries.length - 100);
        
        toDelete.forEach(summary => {
          summaryStore.delete(summary.id);
        });
      }
    };
  }
}

// Main Performance Monitor Implementation
export class PerformanceMonitor implements IPerformanceMonitor {
  private storage: PerformanceStorageService;
  private eventBus: EventBus;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private metrics: Map<string, PerformanceMetric> = new Map();
  private thresholds: Map<string, { warning: number; critical: number }> = new Map();

  constructor(eventBus: EventBus) {
    this.storage = new PerformanceStorageService();
    this.eventBus = eventBus;
    
    // Set default thresholds
    this.setDefaultThresholds();
    
    this.initializeCleanup();
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Start collecting system metrics
    this.monitoringInterval = setInterval(async () => {
      await this.collectSystemMetrics();
    }, 5000); // Collect every 5 seconds
    
    this.eventBus.publish('performance:monitoring:started', { timestamp: new Date() });
    this.emitToBackend('performance:monitoring:started', { timestamp: new Date() });
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    this.eventBus.publish('performance:monitoring:stopped', { timestamp: new Date() });
    this.emitToBackend('performance:monitoring:stopped', { timestamp: new Date() });
  }

  async addMetric(metric: PerformanceMetric): Promise<void> {
    if (!metric.name || !metric.value || !metric.unit || !metric.category) {
      throw new Error('Invalid performance metric');
    }

    metric.id = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    metric.timestamp = new Date();
    
    await this.storage.saveMetric(metric);
    this.metrics.set(metric.id, metric);
    
    // Check thresholds and create alerts if needed
    await this.checkThresholds(metric);
    
    this.eventBus.publish('performance:metric:recorded', { metric });
    this.emitToBackend('performance:metric:recorded', { metric });
  }

  async recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    const metric: PerformanceMetric = {
      id: '',
      name,
      value,
      unit: 'count',
      timestamp: new Date(),
      category: 'custom',
      tags,
      metadata: {}
    };
    
    await this.addMetric(metric);
  }

  async getMetrics(filters?: MetricFilters): Promise<PerformanceMetric[]> {
    return this.storage.getMetrics(filters);
  }

  async getPerformanceSummary(): Promise<PerformanceSummary> {
    const metrics = await this.getMetrics();
    const now = new Date();
    
    // Calculate averages by category
    const cpuMetrics = metrics.filter(m => m.category === 'cpu');
    const memoryMetrics = metrics.filter(m => m.category === 'memory');
    const diskMetrics = metrics.filter(m => m.category === 'disk');
    const networkMetrics = metrics.filter(m => m.category === 'network');
    
    const averageCPU = cpuMetrics.length > 0 
      ? cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length 
      : 0;
    
    const averageMemory = memoryMetrics.length > 0 
      ? memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length 
      : 0;
    
    const averageDisk = diskMetrics.length > 0 
      ? diskMetrics.reduce((sum, m) => sum + m.value, 0) / diskMetrics.length 
      : 0;
    
    const averageNetwork = networkMetrics.length > 0 
      ? networkMetrics.reduce((sum, m) => sum + m.value, 0) / networkMetrics.length 
      : 0;
    
    // Calculate top metrics
    const topMetrics = await this.calculateTopMetrics(metrics);
    
    // Calculate performance trends
    const performanceTrends = await this.calculatePerformanceTrends(metrics);
    
    // Get recent alerts
    const alerts = await this.getRecentAlerts();
    
    const summary: PerformanceSummary = {
      timestamp: now,
      totalMetrics: metrics.length,
      averageCPU,
      averageMemory,
      averageDisk,
      averageNetwork,
      topMetrics,
      performanceTrends,
      alerts
    };
    
    // Save summary
    await this.storage.saveSummary(summary);
    
    return summary;
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const metrics = await this.getMetrics();
    const now = new Date();
    
    // Get latest metrics for each category
    const latestMetrics = new Map<MetricCategory, PerformanceMetric>();
    metrics.forEach(metric => {
      const existing = latestMetrics.get(metric.category);
      if (!existing || metric.timestamp > existing.timestamp) {
        latestMetrics.set(metric.category, metric);
      }
    });
    
    const health: SystemHealth = {
      overall: 'healthy',
      cpu: this.assessComponentHealth(latestMetrics.get('cpu'), 'cpu'),
      memory: this.assessComponentHealth(latestMetrics.get('memory'), 'memory'),
      disk: this.assessComponentHealth(latestMetrics.get('disk'), 'disk'),
      network: this.assessComponentHealth(latestMetrics.get('network'), 'network'),
      database: this.assessComponentHealth(latestMetrics.get('database'), 'database'),
      lastUpdated: now
    };
    
    // Determine overall health
    const componentStatuses = [health.cpu, health.memory, health.disk, health.network, health.database];
    if (componentStatuses.some(c => c.status === 'critical')) {
      health.overall = 'critical';
    } else if (componentStatuses.some(c => c.status === 'warning')) {
      health.overall = 'warning';
    }
    
    // Save health status
    await this.storage.saveHealth(health);
    
    return health;
  }

  async exportPerformanceReport(format: ExportFormat): Promise<string> {
    const summary = await this.getPerformanceSummary();
    const health = await this.getSystemHealth();
    const metrics = await this.getMetrics();
    
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      health,
      totalMetrics: metrics.length,
      metrics: metrics.slice(0, 1000) // Limit to last 1000 metrics
    };
    
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return this.convertToCSV(report);
      case 'xml':
        return this.convertToXML(report);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private setDefaultThresholds(): void {
    this.thresholds.set('cpu_usage', { warning: 80, critical: 95 });
    this.thresholds.set('memory_usage', { warning: 85, critical: 95 });
    this.thresholds.set('disk_usage', { warning: 85, critical: 95 });
    this.thresholds.set('network_latency', { warning: 100, critical: 500 });
    this.thresholds.set('api_response_time', { warning: 1000, critical: 5000 });
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      // Collect CPU usage (simulated)
      const cpuUsage = this.simulateCPUUsage();
      await this.addMetric({
        id: '',
        name: 'cpu_usage',
        value: cpuUsage,
        unit: '%',
        timestamp: new Date(),
        category: 'cpu',
        tags: { source: 'system' }
      });
      
      // Collect memory usage (simulated)
      const memoryUsage = this.simulateMemoryUsage();
      await this.addMetric({
        id: '',
        name: 'memory_usage',
        value: memoryUsage,
        unit: '%',
        timestamp: new Date(),
        category: 'memory',
        tags: { source: 'system' }
      });
      
      // Collect disk usage (simulated)
      const diskUsage = this.simulateDiskUsage();
      await this.addMetric({
        id: '',
        name: 'disk_usage',
        value: diskUsage,
        unit: '%',
        timestamp: new Date(),
        category: 'disk',
        tags: { source: 'system' }
      });
      
      // Collect network metrics (simulated)
      const networkLatency = this.simulateNetworkLatency();
      await this.addMetric({
        id: '',
        name: 'network_latency',
        value: networkLatency,
        unit: 'ms',
        timestamp: new Date(),
        category: 'network',
        tags: { source: 'system' }
      });
      
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  private simulateCPUUsage(): number {
    // Simulate CPU usage between 20-90%
    return 20 + Math.random() * 70;
  }

  private simulateMemoryUsage(): number {
    // Simulate memory usage between 40-95%
    return 40 + Math.random() * 55;
  }

  private simulateDiskUsage(): number {
    // Simulate disk usage between 30-85%
    return 30 + Math.random() * 55;
  }

  private simulateNetworkLatency(): number {
    // Simulate network latency between 5-200ms
    return 5 + Math.random() * 195;
  }

  private async checkThresholds(metric: PerformanceMetric): Promise<void> {
    const thresholdKey = `${metric.name}`;
    const threshold = this.thresholds.get(thresholdKey);
    
    if (!threshold) return;
    
    if (metric.value >= threshold.critical) {
      await this.createAlert(metric, 'critical', threshold.critical);
    } else if (metric.value >= threshold.warning) {
      await this.createAlert(metric, 'warning', threshold.warning);
    }
  }

  private async createAlert(metric: PerformanceMetric, severity: 'warning' | 'critical', threshold: number): Promise<void> {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metric: metric.name,
      severity,
      message: `${metric.name} exceeded ${severity} threshold: ${metric.value} ${metric.unit} > ${threshold} ${metric.unit}`,
      threshold,
      currentValue: metric.value,
      timestamp: new Date()
    };
    
    this.eventBus.publish('performance:alert:created', { alert });
    this.emitToBackend('performance:alert:created', { alert });
  }

  private assessComponentHealth(metric: PerformanceMetric | undefined, category: string): SystemComponentHealth {
    if (!metric) {
      return {
        status: 'healthy',
        value: 0,
        threshold: 100,
        message: 'No metrics available'
      };
    }
    
    const thresholdKey = `${metric.name}`;
    const threshold = this.thresholds.get(thresholdKey);
    
    if (!threshold) {
      return {
        status: 'healthy',
        value: metric.value,
        threshold: 100,
        message: 'No threshold configured'
      };
    }
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let message = 'Component is healthy';
    
    if (metric.value >= threshold.critical) {
      status = 'critical';
      message = `${category} usage is critical`;
    } else if (metric.value >= threshold.warning) {
      status = 'warning';
      message = `${category} usage is high`;
    }
    
    return {
      status,
      value: metric.value,
      threshold: threshold.warning,
      message
    };
  }

  private async calculateTopMetrics(metrics: PerformanceMetric[]): Promise<TopMetric[]> {
    const metricGroups = new Map<string, PerformanceMetric[]>();
    
    // Group metrics by name
    metrics.forEach(metric => {
      if (!metricGroups.has(metric.name)) {
        metricGroups.set(metric.name, []);
      }
      metricGroups.get(metric.name)!.push(metric);
    });
    
    const topMetrics: TopMetric[] = [];
    
    for (const [name, metricList] of metricGroups) {
      if (metricList.length < 2) continue;
      
      const sorted = metricList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      const current = sorted[0].value;
      const previous = sorted[1].value;
      const change = ((current - previous) / previous) * 100;
      
      topMetrics.push({
        name,
        value: current,
        change,
        trend: change > 5 ? 'degrading' : change < -5 ? 'improving' : 'stable',
        category: sorted[0].category
      });
    }
    
    return topMetrics
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 10);
  }

  private async calculatePerformanceTrends(metrics: PerformanceMetric[]): Promise<PerformanceTrend[]> {
    const periods = [
      { name: '1h', hours: 1 },
      { name: '6h', hours: 6 },
      { name: '24h', hours: 24 }
    ];
    
    const trends: PerformanceTrend[] = [];
    
    for (const period of periods) {
      const cutoff = new Date(Date.now() - period.hours * 60 * 60 * 1000);
      const periodMetrics = metrics.filter(m => m.timestamp > cutoff);
      
      // Calculate trends for each metric category
      const categories = ['cpu', 'memory', 'disk', 'network'];
      
      for (const category of categories) {
        const categoryMetrics = periodMetrics.filter(m => m.category === category);
        if (categoryMetrics.length < 2) continue;
        
        const sorted = categoryMetrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
        const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;
        
        const change = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        trends.push({
          period: period.name,
          metric: category,
          averageValue: secondAvg,
          change,
          trend: change > 1 ? 'up' : change < -1 ? 'down' : 'stable'
        });
      }
    }
    
    return trends;
  }

  private async getRecentAlerts(): Promise<PerformanceAlert[]> {
    // This would typically come from the alert manager
    // For now, return empty array
    return [];
  }

  private initializeCleanup(): void {
    // Clean up old data every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.storage.cleanupOldData(30); // Keep 30 days of data
      } catch (error) {
        console.error('Performance data cleanup failed:', error);
      }
    }, 60 * 60 * 1000);
  }

  private convertToCSV(report: any): string {
    const headers = ['Timestamp', 'Total Metrics', 'CPU Avg', 'Memory Avg', 'Disk Avg', 'Network Avg'];
    const rows = [[
      report.summary.timestamp,
      report.summary.totalMetrics,
      report.summary.averageCPU.toFixed(2),
      report.summary.averageMemory.toFixed(2),
      report.summary.averageDisk.toFixed(2),
      report.summary.averageNetwork.toFixed(2)
    ]];
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToXML(report: any): string {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<performanceReport>',
      `  <timestamp>${report.timestamp}</timestamp>`,
      `  <totalMetrics>${report.totalMetrics}</totalMetrics>`,
      '  <summary>',
      `    <averageCPU>${report.summary.averageCPU.toFixed(2)}</averageCPU>`,
      `    <averageMemory>${report.summary.averageMemory.toFixed(2)}</averageMemory>`,
      `    <averageDisk>${report.summary.averageDisk.toFixed(2)}</averageDisk>`,
      `    <averageNetwork>${report.summary.averageNetwork.toFixed(2)}</averageNetwork>`,
      '  </summary>',
      '</performanceReport>'
    ];
    
    return xml.join('\n');
  }

  // Backend migration support
  private emitToBackend(event: string, data: any): void {
    console.log(`[Backend] ${event}:`, data);
  }

  async migrateToBackend(): Promise<void> {
    const metrics = await this.getMetrics();
    const summary = await this.getPerformanceSummary();
    const health = await this.getSystemHealth();
    
    for (const metric of metrics) {
      await this.emitToBackend('performance:metric:migrate', { metric });
    }
    
    await this.emitToBackend('performance:summary:migrate', { summary });
    await this.emitToBackend('performance:health:migrate', { health });
    
    console.log('Performance data migrated to backend');
  }

  // Cleanup
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
export const globalPerformanceMonitor = new PerformanceMonitor(globalEventBus);
