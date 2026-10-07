import { EventBus, globalEventBus } from '@/services/events/EventBus';

// Backend-ready interfaces
export interface IDataQualityMonitor {
  addCheck(check: QualityCheck): Promise<void>;
  removeCheck(checkId: string): Promise<void>;
  getChecks(): Promise<QualityCheck[]>;
  validate(data: any, source?: string): Promise<QualityResult>;
  getQualityMetrics(): Promise<QualityMetrics>;
  getQualityHistory(source?: string, timeRange?: TimeRange): Promise<QualityResult[]>;
  exportQualityReport(format: ExportFormat): Promise<string>;
}

export interface QualityCheck {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  source?: string;
  type: QualityCheckType;
  config: QualityCheckConfig;
  thresholds: QualityThresholds;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export type QualityCheckType = 
  | 'completeness'
  | 'accuracy'
  | 'timeliness'
  | 'validity'
  | 'consistency'
  | 'uniqueness'
  | 'integrity'
  | 'custom';

export interface QualityCheckConfig {
  field?: string;
  expectedValue?: any;
  allowedValues?: any[];
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  format?: string;
  referenceField?: string;
  customLogic?: string;
  timeWindow?: number;
}

export interface QualityThresholds {
  warning: number;
  critical: number;
  minAcceptable: number;
}

export interface QualityResult {
  id: string;
  checkId: string;
  checkName: string;
  source: string;
  timestamp: Date;
  score: number;
  status: 'pass' | 'warning' | 'fail' | 'error';
  details: QualityDetail[];
  metadata?: Record<string, any>;
}

export interface QualityDetail {
  field?: string;
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  expected?: any;
  actual?: any;
  suggestion?: string;
}

export interface QualityMetrics {
  totalChecks: number;
  activeChecks: number;
  totalValidations: number;
  averageScore: number;
  passRate: number;
  warningRate: number;
  failRate: number;
  lastValidation: Date;
  qualityBySource: Record<string, number>;
  qualityByType: Record<string, number>;
  topIssues: QualityIssue[];
}

export interface QualityIssue {
  checkName: string;
  source: string;
  frequency: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  lastOccurrence: Date;
}

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';
export type ExportFormat = 'json' | 'csv' | 'xml' | 'html';

// IndexedDB Storage Service
class QualityStorageService {
  private dbName = 'DataQualityDB';
  private dbVersion = 1;
  private stores = {
    checks: 'quality_checks',
    results: 'quality_results',
    metrics: 'quality_metrics'
  };

  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.stores.checks)) {
          const store = db.createObjectStore(this.stores.checks, { keyPath: 'id' });
          store.createIndex('enabled', 'enabled', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('source', 'source', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(this.stores.results)) {
          const store = db.createObjectStore(this.stores.results, { keyPath: 'id' });
          store.createIndex('checkId', 'checkId', { unique: false });
          store.createIndex('source', 'source', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(this.stores.metrics)) {
          const store = db.createObjectStore(this.stores.metrics, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveCheck(check: QualityCheck): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.checks], 'readwrite');
      const store = transaction.objectStore(this.stores.checks);
      const request = store.put(check);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllChecks(): Promise<QualityCheck[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.checks], 'readonly');
      const store = transaction.objectStore(this.stores.checks);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCheck(checkId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.checks], 'readwrite');
      const store = transaction.objectStore(this.stores.checks);
      const request = store.delete(checkId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveResult(result: QualityResult): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.results], 'readwrite');
      const store = transaction.objectStore(this.stores.results);
      const request = store.put(result);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getResults(source?: string, timeRange?: TimeRange): Promise<QualityResult[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.results], 'readonly');
      const store = transaction.objectStore(this.stores.results);
      
      let request: IDBRequest;
      
      if (source) {
        const index = store.index('source');
        request = index.getAll(source);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => {
        let results = request.result || [];
        results = results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveMetrics(metrics: QualityMetrics): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.metrics], 'readwrite');
      const store = transaction.objectStore(this.stores.metrics);
      const request = store.put(metrics);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Main Data Quality Monitor Implementation
export class DataQualityMonitor implements IDataQualityMonitor {
  private storage: QualityStorageService;
  private eventBus: EventBus;
  private checks: Map<string, QualityCheck> = new Map();
  private metrics: QualityMetrics;

  constructor(eventBus: EventBus) {
    this.storage = new QualityStorageService();
    this.eventBus = eventBus;
    this.metrics = {
      totalChecks: 0,
      activeChecks: 0,
      totalValidations: 0,
      averageScore: 0,
      passRate: 0,
      warningRate: 0,
      failRate: 0,
      lastValidation: new Date(),
      qualityBySource: {},
      qualityByType: {},
      topIssues: []
    };
    
    this.loadChecks();
  }

  async addCheck(check: QualityCheck): Promise<void> {
    if (!check.name || !check.type) {
      throw new Error('Invalid quality check');
    }

    check.createdAt = new Date();
    check.updatedAt = new Date();
    
    await this.storage.saveCheck(check);
    this.checks.set(check.id, check);
    await this.updateMetrics();
    
    this.eventBus.publish('quality:check:added', { check });
    this.emitToBackend('quality:check:added', { check });
  }

  async removeCheck(checkId: string): Promise<void> {
    await this.storage.deleteCheck(checkId);
    this.checks.delete(checkId);
    await this.updateMetrics();
    
    this.eventBus.publish('quality:check:removed', { checkId });
    this.emitToBackend('quality:check:removed', { checkId });
  }

  async getChecks(): Promise<QualityCheck[]> {
    return Array.from(this.checks.values());
  }

  async validate(data: any, source: string = 'unknown'): Promise<QualityResult> {
    const applicableChecks = Array.from(this.checks.values()).filter(check => 
      check.enabled && (!check.source || check.source === source)
    );
    
    const details: QualityDetail[] = [];
    
    for (const check of applicableChecks) {
      const checkDetails = await this.runCheck(check, data);
      details.push(...checkDetails);
    }
    
    const score = this.calculateScore(details);
    const status = this.determineStatus(score);
    
    const result: QualityResult = {
      id: `quality_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      checkId: 'overall',
      checkName: 'Overall Quality',
      source,
      timestamp: new Date(),
      score,
      status,
      details,
      metadata: {
        checksRun: applicableChecks.length
      }
    };
    
    await this.storage.saveResult(result);
    this.eventBus.publish('quality:result:created', { result });
    this.emitToBackend('quality:result:created', { result });
    
    this.metrics.totalValidations++;
    this.metrics.lastValidation = new Date();
    
    return result;
  }

  async getQualityMetrics(): Promise<QualityMetrics> {
    return this.metrics;
  }

  async getQualityHistory(source?: string, timeRange?: TimeRange): Promise<QualityResult[]> {
    return this.storage.getResults(source, timeRange);
  }

  async exportQualityReport(format: ExportFormat): Promise<string> {
    const checks = await this.getChecks();
    const results = await this.storage.getResults();
    const metrics = await this.getQualityMetrics();
    
    const report = {
      timestamp: new Date().toISOString(),
      checks: checks.length,
      results: results.length,
      metrics,
      summary: {
        averageScore: metrics.averageScore,
        passRate: metrics.passRate,
        warningRate: metrics.warningRate,
        failRate: metrics.failRate
      }
    };
    
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return this.convertToCSV(report);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async runCheck(check: QualityCheck, data: any): Promise<QualityDetail[]> {
    switch (check.type) {
      case 'completeness':
        return this.checkCompleteness(data, check.config);
      case 'accuracy':
        return this.checkAccuracy(data, check.config);
      case 'timeliness':
        return this.checkTimeliness(data, check.config);
      case 'validity':
        return this.checkValidity(data, check.config);
      default:
        return [];
    }
  }

  private checkCompleteness(data: any, config: QualityCheckConfig): QualityDetail[] {
    const details: QualityDetail[] = [];
    
    if (config.field) {
      const value = this.getNestedValue(data, config.field);
      if (value === undefined || value === null || value === '') {
        details.push({
          field: config.field,
          issue: 'Field is missing or empty',
          severity: 'high',
          expected: 'Non-empty value',
          actual: value,
          suggestion: 'Ensure field is populated'
        });
      }
    }
    
    return details;
  }

  private checkAccuracy(data: any, config: QualityCheckConfig): QualityDetail[] {
    const details: QualityDetail[] = [];
    
    if (!config.field) return details;
    
    const value = this.getNestedValue(data, config.field);
    
    if (config.expectedValue !== undefined && value !== config.expectedValue) {
      details.push({
        field: config.field,
        issue: 'Value does not match expected',
        severity: 'medium',
        expected: config.expectedValue,
        actual: value,
        suggestion: 'Verify data source accuracy'
      });
    }
    
    if (config.minValue !== undefined && Number(value) < config.minValue) {
      details.push({
        field: config.field,
        issue: 'Value below minimum threshold',
        severity: 'medium',
        expected: `>= ${config.minValue}`,
        actual: value,
        suggestion: 'Verify data source and thresholds'
      });
    }
    
    return details;
  }

  private checkTimeliness(data: any, config: QualityCheckConfig): QualityDetail[] {
    const details: QualityDetail[] = [];
    
    if (!config.field || !config.timeWindow) return details;
    
    const value = this.getNestedValue(data, config.field);
    if (!value) return details;
    
    try {
      const timestamp = new Date(value);
      const now = new Date();
      const timeDiff = (now.getTime() - timestamp.getTime()) / 1000;
      
      if (timeDiff > config.timeWindow) {
        details.push({
          field: config.field,
          issue: 'Data is too old',
          severity: 'medium',
          expected: `Within ${config.timeWindow} seconds`,
          actual: `${timeDiff.toFixed(0)} seconds ago`,
          suggestion: 'Check data source connectivity and frequency'
        });
      }
    } catch (error) {
      details.push({
        field: config.field,
        issue: 'Invalid timestamp format',
        severity: 'high',
        expected: 'Valid date/time format',
        actual: value,
        suggestion: 'Verify timestamp format in data source'
      });
    }
    
    return details;
  }

  private checkValidity(data: any, config: QualityCheckConfig): QualityDetail[] {
    const details: QualityDetail[] = [];
    
    if (!config.field) return details;
    
    const value = this.getNestedValue(data, config.field);
    
    if (config.pattern) {
      try {
        const regex = new RegExp(config.pattern);
        if (!regex.test(String(value))) {
          details.push({
            field: config.field,
            issue: 'Value does not match expected pattern',
            severity: 'medium',
            expected: `Pattern: ${config.pattern}`,
            actual: value,
            suggestion: 'Verify data format matches expected pattern'
          });
        }
      } catch (error) {
        details.push({
          field: config.field,
          issue: 'Invalid regex pattern in check configuration',
          severity: 'critical',
          expected: 'Valid regex pattern',
          actual: config.pattern,
          suggestion: 'Fix regex pattern in quality check configuration'
        });
      }
    }
    
    return details;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private calculateScore(details: QualityDetail[]): number {
    if (details.length === 0) return 1.0;
    
    const severityWeights = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 1.0
    };
    
    const totalWeight = details.reduce((sum, detail) => 
      sum + severityWeights[detail.severity], 0
    );
    
    const maxWeight = details.length;
    return Math.max(0, 1 - (totalWeight / maxWeight));
  }

  private determineStatus(score: number): 'pass' | 'warning' | 'fail' | 'error' {
    if (score >= 0.8) return 'pass';
    if (score >= 0.6) return 'warning';
    if (score >= 0.4) return 'fail';
    return 'error';
  }

  private async loadChecks(): Promise<void> {
    try {
      const checks = await this.storage.getAllChecks();
      checks.forEach(check => this.checks.set(check.id, check));
      await this.updateMetrics();
    } catch (error) {
      console.error('Failed to load quality checks:', error);
    }
  }

  private async updateMetrics(): Promise<void> {
    this.metrics.totalChecks = this.checks.size;
    this.metrics.activeChecks = Array.from(this.checks.values()).filter(c => c.enabled).length;
    
    const recentResults = await this.storage.getResults(undefined, '24h');
    
    if (recentResults.length > 0) {
      const passCount = recentResults.filter(r => r.status === 'pass').length;
      const warningCount = recentResults.filter(r => r.status === 'warning').length;
      const failCount = recentResults.filter(r => r.status === 'fail').length;
      const errorCount = recentResults.filter(r => r.status === 'error').length;
      
      this.metrics.passRate = passCount / recentResults.length;
      this.metrics.warningRate = warningCount / recentResults.length;
      this.metrics.failRate = (failCount + errorCount) / recentResults.length;
      this.metrics.averageScore = recentResults.reduce((sum, r) => sum + r.score, 0) / recentResults.length;
    }
    
    await this.storage.saveMetrics(this.metrics);
  }

  private convertToCSV(report: any): string {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Checks', report.checks],
      ['Total Results', report.results],
      ['Average Score', report.metrics.averageScore.toFixed(3)],
      ['Pass Rate', (report.metrics.passRate * 100).toFixed(1) + '%'],
      ['Warning Rate', (report.metrics.warningRate * 100).toFixed(1) + '%'],
      ['Fail Rate', (report.metrics.failRate * 100).toFixed(1) + '%']
    ];
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private emitToBackend(event: string, data: any): void {
    console.log(`[Backend] ${event}:`, data);
  }

  async migrateToBackend(): Promise<void> {
    const checks = await this.getChecks();
    const results = await this.storage.getResults();
    const metrics = await this.getQualityMetrics();
    
    for (const check of checks) {
      await this.emitToBackend('quality:check:migrate', { check });
    }
    
    for (const result of results) {
      await this.emitToBackend('quality:result:migrate', { result });
    }
    
    await this.emitToBackend('quality:metrics:migrate', { metrics });
    
    console.log('Quality data migrated to backend');
  }
}

// Export singleton instance
export const globalDataQualityMonitor = new DataQualityMonitor(globalEventBus);
