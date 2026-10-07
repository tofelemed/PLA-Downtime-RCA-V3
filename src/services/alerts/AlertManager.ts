import { EventBus, globalEventBus } from '@/services/events/EventBus';

// Backend-ready interfaces
export interface IAlertManager {
  createAlert(alert: Alert): Promise<void>;
  updateAlert(alert: Alert): Promise<void>;
  acknowledgeAlert(alertId: string, userId: string): Promise<void>;
  resolveAlert(alertId: string, userId: string, resolution?: string): Promise<void>;
  getAlerts(filters?: AlertFilters): Promise<Alert[]>;
  getAlert(alertId: string): Promise<Alert | null>;
  deleteAlert(alertId: string): Promise<void>;
  getAlertMetrics(): Promise<AlertMetrics>;
  exportAlerts(format: ExportFormat): Promise<string>;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  source: string;
  sourceId?: string;
  status: AlertStatus;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  tags?: string[];
}

export type AlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type AlertCategory = 'system' | 'security' | 'performance' | 'quality' | 'business' | 'custom';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'expired' | 'suppressed';

export interface AlertFilters {
  severity?: AlertSeverity[];
  category?: AlertCategory[];
  status?: AlertStatus[];
  source?: string[];
  acknowledged?: boolean;
  resolved?: boolean;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  search?: string;
}

export interface AlertMetrics {
  totalAlerts: number;
  activeAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  criticalAlerts: number;
  alertsBySeverity: Record<AlertSeverity, number>;
  alertsByCategory: Record<AlertCategory, number>;
  alertsBySource: Record<string, number>;
  averageResolutionTime: number;
  topSources: AlertSource[];
}

export interface AlertSource {
  name: string;
  count: number;
  lastAlert: Date;
  averageSeverity: number;
}

export type ExportFormat = 'json' | 'csv' | 'xml';

// IndexedDB Storage Service
class AlertStorageService {
  private dbName = 'AlertManagerDB';
  private dbVersion = 1;
  private stores = {
    alerts: 'alerts',
    metrics: 'alert_metrics'
  };

  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.stores.alerts)) {
          const store = db.createObjectStore(this.stores.alerts, { keyPath: 'id' });
          store.createIndex('severity', 'severity', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('source', 'source', { unique: false });
          store.createIndex('acknowledged', 'acknowledged', { unique: false });
          store.createIndex('resolved', 'resolved', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('severity_status', ['severity', 'status'], { unique: false });
          store.createIndex('source_status', ['source', 'status'], { unique: false });
        }
        
        if (!db.objectStoreNames.contains(this.stores.metrics)) {
          const store = db.createObjectStore(this.stores.metrics, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
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

  async getAlert(alertId: string): Promise<Alert | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.alerts], 'readonly');
      const store = transaction.objectStore(this.stores.alerts);
      const request = store.get(alertId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllAlerts(): Promise<Alert[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.alerts], 'readonly');
      const store = transaction.objectStore(this.stores.alerts);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getAlertsByFilter(filters: AlertFilters): Promise<Alert[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.alerts], 'readonly');
      const store = transaction.objectStore(this.stores.alerts);
      
      let alerts: Alert[] = [];
      
      // Apply filters
      if (filters.severity && filters.severity.length > 0) {
        const severityAlerts: Alert[] = [];
        filters.severity.forEach(severity => {
          const index = store.index('severity');
          const request = index.getAll(severity);
          request.onsuccess = () => {
            severityAlerts.push(...(request.result || []));
          };
        });
        alerts = severityAlerts;
      } else if (filters.status && filters.status.length > 0) {
        const statusAlerts: Alert[] = [];
        filters.status.forEach(status => {
          const index = store.index('status');
          const request = index.getAll(status);
          request.onsuccess = () => {
            statusAlerts.push(...(request.result || []));
          };
        });
        alerts = statusAlerts;
      } else if (filters.source && filters.source.length > 0) {
        const sourceAlerts: Alert[] = [];
        filters.source.forEach(source => {
          const index = store.index('source');
          const request = index.getAll(source);
          request.onsuccess = () => {
            sourceAlerts.push(...(request.result || []));
          };
        });
        alerts = sourceAlerts;
      } else {
        const request = store.getAll();
        request.onsuccess = () => {
          alerts = request.result || [];
        };
      }
      
      // Apply additional filters in memory
      if (filters.acknowledged !== undefined) {
        alerts = alerts.filter(alert => alert.acknowledged === filters.acknowledged);
      }
      
      if (filters.resolved !== undefined) {
        alerts = alerts.filter(alert => alert.resolved === filters.resolved);
      }
      
      if (filters.startDate) {
        alerts = alerts.filter(alert => alert.createdAt >= filters.startDate!);
      }
      
      if (filters.endDate) {
        alerts = alerts.filter(alert => alert.createdAt <= filters.endDate!);
      }
      
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        alerts = alerts.filter(alert => 
          alert.title.toLowerCase().includes(searchTerm) ||
          alert.message.toLowerCase().includes(searchTerm) ||
          alert.source.toLowerCase().includes(searchTerm)
        );
      }
      
      // Sort by creation date (newest first)
      alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      resolve(alerts);
    });
  }

  async deleteAlert(alertId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.alerts], 'readwrite');
      const store = transaction.objectStore(this.stores.alerts);
      const request = store.delete(alertId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveMetrics(metrics: AlertMetrics): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.stores.metrics], 'readwrite');
      const store = transaction.objectStore(this.stores.metrics);
      const request = store.put(metrics);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async cleanupExpiredAlerts(): Promise<void> {
    const db = await this.initDB();
    const transaction = db.transaction([this.stores.alerts], 'readwrite');
    const store = transaction.objectStore(this.stores.alerts);
    const index = store.index('expiresAt');
    
    const now = new Date();
    const request = index.openCursor(IDBKeyRange.upperBound(now));
    
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const alert = cursor.value;
          if (alert.expiresAt && alert.expiresAt < now) {
            alert.status = 'expired';
            store.put(alert);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Main Alert Manager Implementation
export class AlertManager implements IAlertManager {
  private storage: AlertStorageService;
  private eventBus: EventBus;
  private alerts: Map<string, Alert> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private metrics: AlertMetrics;

  constructor(eventBus: EventBus) {
    this.storage = new AlertStorageService();
    this.eventBus = eventBus;
    this.metrics = {
      totalAlerts: 0,
      activeAlerts: 0,
      acknowledgedAlerts: 0,
      resolvedAlerts: 0,
      criticalAlerts: 0,
      alertsBySeverity: {
        info: 0, low: 0, medium: 0, high: 0, critical: 0
      },
      alertsByCategory: {
        system: 0, security: 0, performance: 0, quality: 0, business: 0, custom: 0
      },
      alertsBySource: {},
      averageResolutionTime: 0,
      topSources: []
    };
    
    this.initializeCleanup();
    this.loadAlerts();
  }

  async createAlert(alert: Alert): Promise<void> {
    // Validate alert
    if (!alert.title || !alert.message || !alert.severity || !alert.category || !alert.source) {
      throw new Error('Invalid alert data');
    }

    // Set timestamps
    alert.createdAt = new Date();
    alert.updatedAt = new Date();
    alert.id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set default status
    if (!alert.status) {
      alert.status = 'active';
    }
    
    // Set expiration if not provided (default: 30 days)
    if (!alert.expiresAt) {
      alert.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    
    // Save to storage
    await this.storage.saveAlert(alert);
    
    // Add to memory cache
    this.alerts.set(alert.id, alert);
    
    // Update metrics
    await this.updateMetrics();
    
    // Publish event
    this.eventBus.publish('alert:created', { alert });
    
    // Emit to backend when available
    this.emitToBackend('alert:created', { alert });
    
    // Check if this is a critical alert and trigger immediate notification
    if (alert.severity === 'critical') {
      this.eventBus.publish('alert:critical', { alert });
      this.emitToBackend('alert:critical', { alert });
    }
  }

  async updateAlert(alert: Alert): Promise<void> {
    alert.updatedAt = new Date();
    
    await this.storage.saveAlert(alert);
    this.alerts.set(alert.id, alert);
    
    await this.updateMetrics();
    
    this.eventBus.publish('alert:updated', { alert });
    this.emitToBackend('alert:updated', { alert });
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = await this.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }
    
    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    alert.status = 'acknowledged';
    alert.updatedAt = new Date();
    
    await this.updateAlert(alert);
    
    this.eventBus.publish('alert:acknowledged', { alert, userId });
    this.emitToBackend('alert:acknowledged', { alert, userId });
  }

  async resolveAlert(alertId: string, userId: string, resolution?: string): Promise<void> {
    const alert = await this.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }
    
    alert.resolved = true;
    alert.resolvedBy = userId;
    alert.resolvedAt = new Date();
    alert.status = 'resolved';
    alert.resolution = resolution || 'Resolved by user';
    alert.updatedAt = new Date();
    
    await this.updateAlert(alert);
    
    this.eventBus.publish('alert:resolved', { alert, userId, resolution });
    this.emitToBackend('alert:resolved', { alert, userId, resolution });
  }

  async getAlerts(filters?: AlertFilters): Promise<Alert[]> {
    if (filters) {
      return this.storage.getAlertsByFilter(filters);
    }
    return Array.from(this.alerts.values());
  }

  async getAlert(alertId: string): Promise<Alert | null> {
    return this.storage.getAlert(alertId);
  }

  async deleteAlert(alertId: string): Promise<void> {
    await this.storage.deleteAlert(alertId);
    this.alerts.delete(alertId);
    
    await this.updateMetrics();
    
    this.eventBus.publish('alert:deleted', { alertId });
    this.emitToBackend('alert:deleted', { alertId });
  }

  async getAlertMetrics(): Promise<AlertMetrics> {
    return this.metrics;
  }

  async exportAlerts(format: ExportFormat): Promise<string> {
    const alerts = await this.getAlerts();
    const metrics = await this.getAlertMetrics();
    
    const report = {
      timestamp: new Date().toISOString(),
      totalAlerts: alerts.length,
      metrics,
      alerts: alerts.map(alert => ({
        id: alert.id,
        title: alert.title,
        severity: alert.severity,
        category: alert.category,
        source: alert.source,
        status: alert.status,
        createdAt: alert.createdAt.toISOString(),
        resolvedAt: alert.resolvedAt?.toISOString()
      }))
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

  private async loadAlerts(): Promise<void> {
    try {
      const alerts = await this.storage.getAllAlerts();
      alerts.forEach(alert => this.alerts.set(alert.id, alert));
      await this.updateMetrics();
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  }

  private async updateMetrics(): Promise<void> {
    const alerts = Array.from(this.alerts.values());
    
    this.metrics.totalAlerts = alerts.length;
    this.metrics.activeAlerts = alerts.filter(a => a.status === 'active').length;
    this.metrics.acknowledgedAlerts = alerts.filter(a => a.acknowledged).length;
    this.metrics.resolvedAlerts = alerts.filter(a => a.resolved).length;
    this.metrics.criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    
    // Calculate alerts by severity
    this.metrics.alertsBySeverity = {
      info: alerts.filter(a => a.severity === 'info').length,
      low: alerts.filter(a => a.severity === 'low').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      high: alerts.filter(a => a.severity === 'high').length,
      critical: alerts.filter(a => a.severity === 'critical').length
    };
    
    // Calculate alerts by category
    this.metrics.alertsByCategory = {
      system: alerts.filter(a => a.category === 'system').length,
      security: alerts.filter(a => a.category === 'security').length,
      performance: alerts.filter(a => a.category === 'performance').length,
      quality: alerts.filter(a => a.category === 'quality').length,
      business: alerts.filter(a => a.category === 'business').length,
      custom: alerts.filter(a => a.category === 'custom').length
    };
    
    // Calculate alerts by source
    const sourceMap = new Map<string, number>();
    alerts.forEach(alert => {
      sourceMap.set(alert.source, (sourceMap.get(alert.source) || 0) + 1);
    });
    
    this.metrics.alertsBySource = Object.fromEntries(sourceMap);
    
    // Calculate average resolution time
    const resolvedAlerts = alerts.filter(a => a.resolved && a.resolvedAt && a.createdAt);
    if (resolvedAlerts.length > 0) {
      const totalTime = resolvedAlerts.reduce((sum, alert) => {
        return sum + (alert.resolvedAt!.getTime() - alert.createdAt.getTime());
      }, 0);
      this.metrics.averageResolutionTime = totalTime / resolvedAlerts.length;
    }
    
    // Calculate top sources
    this.metrics.topSources = Array.from(sourceMap.entries())
      .map(([name, count]) => {
        const sourceAlerts = alerts.filter(a => a.source === name);
        const lastAlert = Math.max(...sourceAlerts.map(a => a.createdAt.getTime()));
        const averageSeverity = sourceAlerts.reduce((sum, a) => {
          const severityValues = { info: 1, low: 2, medium: 3, high: 4, critical: 5 };
          return sum + severityValues[a.severity];
        }, 0) / sourceAlerts.length;
        
        return {
          name,
          count,
          lastAlert: new Date(lastAlert),
          averageSeverity
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Save metrics
    await this.storage.saveMetrics(this.metrics);
  }

  private initializeCleanup(): void {
    // Clean up expired alerts every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.storage.cleanupExpiredAlerts();
        await this.updateMetrics();
      } catch (error) {
        console.error('Alert cleanup failed:', error);
      }
    }, 60 * 60 * 1000);
  }

  private convertToCSV(report: any): string {
    const headers = ['ID', 'Title', 'Severity', 'Category', 'Source', 'Status', 'Created', 'Resolved'];
    const rows = report.alerts.map((alert: any) => [
      alert.id,
      alert.title,
      alert.severity,
      alert.category,
      alert.source,
      alert.status,
      alert.createdAt,
      alert.resolvedAt || ''
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToXML(report: any): string {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<alertReport>',
      `  <timestamp>${report.timestamp}</timestamp>`,
      `  <totalAlerts>${report.totalAlerts}</totalAlerts>`,
      '  <alerts>',
      ...report.alerts.map((alert: any) => [
        '    <alert>',
        `      <id>${alert.id}</id>`,
        `      <title>${alert.title}</title>`,
        `      <severity>${alert.severity}</severity>`,
        `      <category>${alert.category}</category>`,
        `      <source>${alert.source}</source>`,
        `      <status>${alert.status}</status>`,
        `      <createdAt>${alert.createdAt}</createdAt>`,
        alert.resolvedAt ? `      <resolvedAt>${alert.resolvedAt}</resolvedAt>` : '',
        '    </alert>'
      ].filter(line => line !== '')),
      '  </alerts>',
      '</alertReport>'
    ];
    
    return xml.join('\n');
  }

  // Backend migration support
  private emitToBackend(event: string, data: any): void {
    console.log(`[Backend] ${event}:`, data);
  }

  async migrateToBackend(): Promise<void> {
    const alerts = await this.getAlerts();
    const metrics = await this.getAlertMetrics();
    
    for (const alert of alerts) {
      await this.emitToBackend('alert:migrate', { alert });
    }
    
    await this.emitToBackend('alert:metrics:migrate', { metrics });
    
    console.log('Alert data migrated to backend');
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
export const globalAlertManager = new AlertManager(globalEventBus);
