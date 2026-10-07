// Modular storage service abstraction - can be swapped for API later
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  tenantId?: string;
  organizationId?: string;
}

export interface User extends BaseEntity {
  name: string;
  email: string;
  passwordHash: string;
  role: 'SuperAdmin' | 'OrgAdmin' | 'TenantAdmin' | 'Manager' | 'Analyst' | 'Engineer' | 'Operator';
  isActive: boolean;
  tenantId?: string;
  organizationId?: string;
  phone?: string;
  department?: string;
}

export interface Organization extends BaseEntity {
  name: string;
  code: string;
  description?: string;
}

export interface Tenant extends BaseEntity {
  name: string;
  code: string;
  organizationId: string;
  description?: string;
}

export interface Unit extends BaseEntity {
  name: string;
  code: string;
  tenantId: string;
  description?: string;
}

export interface Asset extends BaseEntity {
  name: string;
  code: string;
  unitId: string;
  description?: string;
}

export interface AuditLog extends BaseEntity {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, any>;
  timestamp: string;
}

export class StorageService {
  private dbName = 'ProActDB';
  private version = 19; // Incremented to add PI sync jobs store for automated event syncing
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[StorageService] Database initialized successfully. Available stores:', Array.from(this.db.objectStoreNames));
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion;
        console.log('[StorageService] onupgradeneeded: oldVersion', oldVersion, 'newVersion', newVersion);
        
        // Create object stores for all entity types
        const stores = [
          'users', 'organizations', 'tenants', 'units', 'assets', 'auditLogs',
          'impactCodes', 'oeeCodes', 'rcaCauseCodes', 'verificationStatusCodes',
          'products', 'productionPlans', 'productionPlanTemplates', 'productionEvents', 'rcas', 'rcaRecommendations',
          'rcaEvidence', 'logicTreeNodes', 'rcaTriggerConfigs',
          'rcaKnowledgeBase', 'rcaAnalysisConfigs', 'fiveWhyAnalyses', 'fishboneDiagrams', 
          'fmeaAnalyses', 'faultTreeAnalyses', 'barrierAnalyses', 'changeAnalyses',
          'appSettings',
          'rcaTemplates',
          'evidenceCategories',
          'evidenceLocations',
          'productionLosses', 'oeeSummaries', 'reconcileForms', 'lossCategories',
          // Add unmappedEvents store
          'unmappedEvents',
          'reasonCodes',
          'dashboardConfigurations',
          // PI Integration stores
          'piConnections', 'piAfElements', 'afBindings', 'piEvents', 'piMappings', 'piSyncWatermarks', 'piSyncJobs', 'historianTags',
          // Integration stores
          'dataSources',
          // Custom attribute stores
          'customAttributeDefinitions', 'customAttributeValues',
        ];
        
        console.log('[StorageService] Available object stores before creation:', Array.from(db.objectStoreNames));
        stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            console.log('[StorageService] Creating object store:', storeName);
            if (storeName === 'appSettings') {
              db.createObjectStore('appSettings', { keyPath: 'key' });
            } else {
              const store = db.createObjectStore(storeName, { keyPath: 'id' });
              if (!store.indexNames.contains('tenantId')) store.createIndex('tenantId', 'tenantId', { unique: false });
              if (!store.indexNames.contains('organizationId')) store.createIndex('organizationId', 'organizationId', { unique: false });
              if (!store.indexNames.contains('createdAt')) store.createIndex('createdAt', 'createdAt', { unique: false });
              
              // Add specific indexes for certain stores
              if (storeName === 'productionEvents') {
                if (!store.indexNames.contains('unitId')) store.createIndex('unitId', 'unitId', { unique: false });
                if (!store.indexNames.contains('status')) store.createIndex('status', 'status', { unique: false });
              }
              if (storeName === 'rcas') {
                if (!store.indexNames.contains('eventId')) store.createIndex('eventId', 'eventId', { unique: false });
                if (!store.indexNames.contains('status')) store.createIndex('status', 'status', { unique: false });
              }
              if (storeName === 'productionLosses') {
                if (!store.indexNames.contains('planId')) store.createIndex('planId', 'planId', { unique: false });
                if (!store.indexNames.contains('period')) store.createIndex('period', 'period', { unique: false });
              }
              if (storeName === 'oeeSummaries') {
                if (!store.indexNames.contains('planId')) store.createIndex('planId', 'planId', { unique: false });
                if (!store.indexNames.contains('period')) store.createIndex('period', 'period', { unique: false });
              }
              if (storeName === 'reconcileForms') {
                if (!store.indexNames.contains('lossId')) store.createIndex('lossId', 'lossId', { unique: false });
                if (!store.indexNames.contains('status')) store.createIndex('status', 'status', { unique: false });
              }
              if (storeName === 'lossCategories') {
                if (!store.indexNames.contains('reconcileFormId')) store.createIndex('reconcileFormId', 'reconcileFormId', { unique: false });
              }
              // Add indexes for unmappedEvents
              if (storeName === 'unmappedEvents') {
                if (!store.indexNames.contains('tenantId')) store.createIndex('tenantId', 'tenantId', { unique: false });
                if (!store.indexNames.contains('unitId')) store.createIndex('unitId', 'unitId', { unique: false });
                if (!store.indexNames.contains('createdAt')) store.createIndex('createdAt', 'createdAt', { unique: false });
              }
              // PI integration indexes
              if (storeName === 'piConnections') {
                if (!store.indexNames.contains('tenantId')) store.createIndex('tenantId', 'tenantId', { unique: false });
              }
              // Custom attribute indexes
              if (storeName === 'customAttributeDefinitions') {
                if (!store.indexNames.contains('entityType')) store.createIndex('entityType', 'entityType', { unique: false });
                if (!store.indexNames.contains('tenantId')) store.createIndex('tenantId', 'tenantId', { unique: false });
                if (!store.indexNames.contains('organizationId')) store.createIndex('organizationId', 'organizationId', { unique: false });
              }
              if (storeName === 'customAttributeValues') {
                if (!store.indexNames.contains('entityId')) store.createIndex('entityId', 'entityId', { unique: false });
                if (!store.indexNames.contains('entityType')) store.createIndex('entityType', 'entityType', { unique: false });
                if (!store.indexNames.contains('attributeDefinitionId')) store.createIndex('attributeDefinitionId', 'attributeDefinitionId', { unique: false });
              }
              if (storeName === 'piAfElements') {
                if (!store.indexNames.contains('parentId')) store.createIndex('parentId', 'parentId', { unique: false });
                if (!store.indexNames.contains('template')) store.createIndex('template', 'template', { unique: false });
              }
              if (storeName === 'afBindings') {
                if (!store.indexNames.contains('tenantId')) store.createIndex('tenantId', 'tenantId', { unique: false });
                if (!store.indexNames.contains('webId')) store.createIndex('webId', 'webId', { unique: false });
                if (!store.indexNames.contains('boundType')) store.createIndex('boundType', 'boundType', { unique: false });
                if (!store.indexNames.contains('localId')) store.createIndex('localId', 'localId', { unique: false });
              }
              if (storeName === 'piEvents') {
                if (!store.indexNames.contains('template')) store.createIndex('template', 'template', { unique: false });
                if (!store.indexNames.contains('primaryAfId')) store.createIndex('primaryAfId', 'primaryAfId', { unique: false });
                if (!store.indexNames.contains('startUtc')) store.createIndex('startUtc', 'startUtc', { unique: false });
              }
              if (storeName === 'historianTags') {
                if (!store.indexNames.contains('tenantId')) store.createIndex('tenantId', 'tenantId', { unique: false });
                if (!store.indexNames.contains('webId')) store.createIndex('webId', 'webId', { unique: false });
                if (!store.indexNames.contains('category')) store.createIndex('category', 'category', { unique: false });
                if (!store.indexNames.contains('enabled')) store.createIndex('enabled', 'enabled', { unique: false });
              }
              // Add indexes for dataSources
              if (storeName === 'dataSources') {
                if (!store.indexNames.contains('type')) store.createIndex('type', 'type', { unique: false });
                if (!store.indexNames.contains('status')) store.createIndex('status', 'status', { unique: false });
                if (!store.indexNames.contains('enabled')) store.createIndex('enabled', 'enabled', { unique: false });
              }
            }
          } else {
            console.log('[StorageService] Store already exists:', storeName);
          }
        });
      };
    });
  }

  async create<T extends BaseEntity>(storeName: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const entity: T = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as T;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(entity);
      
      request.onsuccess = () => {
        // Emit event for real-time updates
        this.emitUpdate(storeName, 'create', entity);
        resolve(entity);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get<T extends BaseEntity>(storeName: string, id: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async update<T extends BaseEntity>(storeName: string, id: string, updates: Partial<T>): Promise<T> {
    const existing = await this.get<T>(storeName, id);
    if (!existing) throw new Error(`Entity with id ${id} not found`);

    const updated: T = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(updated);
      
      request.onsuccess = () => {
        this.emitUpdate(storeName, 'update', updated);
        resolve(updated);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        this.emitUpdate(storeName, 'delete', { id });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async query<T extends BaseEntity>(
    storeName: string, 
    filters?: { tenantId?: string; organizationId?: string; unitId?: string; status?: string; planId?: string; period?: string; lossId?: string }
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        let results = request.result as T[];
        
        if (filters) {
          results = results.filter(item => {
            if (filters.tenantId && item.tenantId !== filters.tenantId) return false;
            if (filters.organizationId && item.organizationId !== filters.organizationId) return false;
            if (filters.unitId && (item as any).unitId !== filters.unitId) return false;
            if (filters.status && (item as any).status !== filters.status) return false;
            if (filters.planId && (item as any).planId !== filters.planId) return false;
            if (filters.period && (item as any).period !== filters.period) return false;
            if (filters.lossId && (item as any).lossId !== filters.lossId) return false;
            return true;
          });
        }
        
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async logAudit(userId: string, action: string, entityType: string, entityId: string, details: Record<string, any>): Promise<void> {
    await this.create<AuditLog>('auditLogs', {
      userId,
      action,
      entityType,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  // Real-time collaboration simulation
  private emitUpdate(storeName: string, action: string, data: any) {
    // Simulate real-time updates by dispatching custom events
    const event = new CustomEvent('dataUpdate', {
      detail: { storeName, action, data, timestamp: new Date().toISOString() }
    });
    window.dispatchEvent(event);
  }

  // Listen for real-time updates
  onUpdate(callback: (storeName: string, action: string, data: any) => void) {
    const handler = (event: CustomEvent) => {
      const { storeName, action, data } = event.detail;
      callback(storeName, action, data);
    };
    window.addEventListener('dataUpdate', handler as EventListener);
    
    // Return cleanup function
    return () => window.removeEventListener('dataUpdate', handler as EventListener);
  }

  // Set a key-value pair in appSettings
  async setAppSetting(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['appSettings'], 'readwrite');
      const store = transaction.objectStore('appSettings');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get a value from appSettings by key
  async getAppSetting<T = any>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['appSettings'], 'readonly');
      const store = transaction.objectStore('appSettings');
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result) resolve(request.result.value as T);
        else resolve(null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- Unmapped Events CRUD ---
  async createUnmappedEvent(data: Omit<any, 'id' | 'createdAt' | 'updatedAt'>): Promise<any> {
    return this.create<any>('unmappedEvents', data);
  }

  async getUnmappedEvent(id: string): Promise<any | null> {
    return this.get<any>('unmappedEvents', id);
  }

  async updateUnmappedEvent(id: string, updates: Partial<any>): Promise<any> {
    return this.update<any>('unmappedEvents', id, updates);
  }

  async deleteUnmappedEvent(id: string): Promise<void> {
    return this.delete('unmappedEvents', id);
  }

  async queryUnmappedEvents(filters?: { tenantId?: string; unitId?: string }): Promise<any[]> {
    return this.query<any>('unmappedEvents', filters);
  }
}

// IndexedDB service for historian query history
export class HistorianHistoryDB {
  private dbName = 'ProActHistorianDB';
  private version = 1;
  private db: IDBDatabase | null = null;
  private fallbackStorage: Map<string, any[]> = new Map(); // Fallback for when IndexedDB is not available
  private useFallback = false;

  async init(): Promise<void> {
    // Check if IndexedDB is available
    if (!window.indexedDB) {
      this.useFallback = true;
      return;
    }

    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => {
          console.warn('IndexedDB not available, using fallback storage');
          this.useFallback = true;
          resolve();
        };
        
        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Create object store for query history
          if (!db.objectStoreNames.contains('queryHistory')) {
            const store = db.createObjectStore('queryHistory', { keyPath: 'id' });
            store.createIndex('tenantId', 'tenantId', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
      });
    } catch (error) {
      console.warn('IndexedDB initialization failed, using fallback storage:', error);
      this.useFallback = true;
    }
  }

  async saveQueryHistory(tenantId: string, history: Array<{
    id: string;
    timestamp: string;
    attributes: any[];
    queryParams: any;
    resultCount: number;
    tenantId: string;
  }>): Promise<void> {
    if (this.useFallback) {
      this.fallbackStorage.set(tenantId, history);
      return;
    }

    if (!this.db) await this.init();

    if (this.useFallback) {
      this.fallbackStorage.set(tenantId, history);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queryHistory'], 'readwrite');
      const store = transaction.objectStore('queryHistory');

      // Clear existing history for this tenant
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        // Add new history entries
        let completed = 0;
        const total = history.length;

        if (total === 0) {
          resolve();
          return;
        }

        history.forEach((entry) => {
          const addRequest = store.add({
            ...entry,
            tenantId
          });

          addRequest.onsuccess = () => {
            completed++;
            if (completed === total) {
              resolve();
            }
          };

          addRequest.onerror = () => {
            reject(addRequest.error);
          };
        });
      };

      clearRequest.onerror = () => {
        reject(clearRequest.error);
      };
    });
  }

  async loadQueryHistory(tenantId: string): Promise<Array<{
    id: string;
    timestamp: string;
    attributes: any[];
    queryParams: any;
    resultCount: number;
    tenantId: string;
  }>> {
    if (this.useFallback) {
      const history = this.fallbackStorage.get(tenantId) || [];
      return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    if (!this.db) await this.init();

    if (this.useFallback) {
      const history = this.fallbackStorage.get(tenantId) || [];
      return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queryHistory'], 'readonly');
      const store = transaction.objectStore('queryHistory');
      const index = store.index('tenantId');
      const request = index.getAll(tenantId);

      request.onsuccess = () => {
        const results = request.result || [];
        // Sort by timestamp descending (most recent first)
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(results);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async addQueryHistoryEntry(tenantId: string, entry: {
    id: string;
    timestamp: string;
    attributes: any[];
    queryParams: any;
    resultCount: number;
  }): Promise<void> {
    if (this.useFallback) {
      const history = this.fallbackStorage.get(tenantId) || [];
      history.unshift({ ...entry, tenantId });
      // Keep only last 20 entries
      if (history.length > 20) {
        history.splice(20);
      }
      this.fallbackStorage.set(tenantId, history);
      return;
    }

    if (!this.db) await this.init();

    if (this.useFallback) {
      const history = this.fallbackStorage.get(tenantId) || [];
      history.unshift({ ...entry, tenantId });
      if (history.length > 20) {
        history.splice(20);
      }
      this.fallbackStorage.set(tenantId, history);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queryHistory'], 'readwrite');
      const store = transaction.objectStore('queryHistory');
      
      const addRequest = store.add({
        ...entry,
        tenantId
      });

      addRequest.onsuccess = () => resolve();
      addRequest.onerror = () => reject(addRequest.error);
    });
  }

  async removeQueryHistoryEntry(id: string): Promise<void> {
    if (this.useFallback) {
      // Remove from all tenants in fallback storage
      for (const [tenantId, history] of this.fallbackStorage.entries()) {
        const filteredHistory = history.filter(entry => entry.id !== id);
        this.fallbackStorage.set(tenantId, filteredHistory);
      }
      return;
    }

    if (!this.db) await this.init();

    if (this.useFallback) {
      for (const [tenantId, history] of this.fallbackStorage.entries()) {
        const filteredHistory = history.filter(entry => entry.id !== id);
        this.fallbackStorage.set(tenantId, filteredHistory);
      }
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queryHistory'], 'readwrite');
      const store = transaction.objectStore('queryHistory');
      
      const deleteRequest = store.delete(id);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }

  async clearQueryHistory(tenantId: string): Promise<void> {
    if (this.useFallback) {
      this.fallbackStorage.set(tenantId, []);
      return;
    }

    if (!this.db) await this.init();

    if (this.useFallback) {
      this.fallbackStorage.set(tenantId, []);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['queryHistory'], 'readwrite');
      const store = transaction.objectStore('queryHistory');
      const index = store.index('tenantId');
      
      const request = index.getAllKeys(tenantId);
      
      request.onsuccess = () => {
        const keys = request.result || [];
        if (keys.length === 0) {
          resolve();
          return;
        }

        let completed = 0;
        const total = keys.length;

        keys.forEach((key) => {
          const deleteRequest = store.delete(key);
          
          deleteRequest.onsuccess = () => {
            completed++;
            if (completed === total) {
              resolve();
            }
          };

          deleteRequest.onerror = () => {
            reject(deleteRequest.error);
          };
        });
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async exportQueryHistory(tenantId: string): Promise<any[]> {
    const history = await this.loadQueryHistory(tenantId);
    return history.map(entry => ({
      timestamp: entry.timestamp,
      attributes: entry.attributes.length,
      mode: entry.queryParams.mode,
      startTime: entry.queryParams.start,
      endTime: entry.queryParams.end,
      resultCount: entry.resultCount,
      attributeNames: entry.attributes.map(attr => attr.Name).join(', ')
    }));
  }

  async importQueryHistory(tenantId: string, importedHistory: any[]): Promise<void> {
    if (this.useFallback) {
      const transformedHistory = importedHistory
        .filter(entry => entry.timestamp && entry.attributes && entry.queryParams)
        .map(entry => ({
          id: entry.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
          timestamp: entry.timestamp,
          attributes: Array.isArray(entry.attributes) ? entry.attributes : [],
          queryParams: entry.queryParams || {},
          resultCount: entry.resultCount || 0,
          tenantId
        }));

      if (transformedHistory.length > 0) {
        const existingHistory = this.fallbackStorage.get(tenantId) || [];
        const combinedHistory = [...transformedHistory, ...existingHistory];
        const limitedHistory = combinedHistory.slice(0, 20);
        this.fallbackStorage.set(tenantId, limitedHistory);
      }
      return;
    }

    if (!this.db) await this.init();

    if (this.useFallback) {
      const transformedHistory = importedHistory
        .filter(entry => entry.timestamp && entry.attributes && entry.queryParams)
        .map(entry => ({
          id: entry.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
          timestamp: entry.timestamp,
          attributes: Array.isArray(entry.attributes) ? entry.attributes : [],
          queryParams: entry.queryParams || {},
          resultCount: entry.resultCount || 0,
          tenantId
        }));

      if (transformedHistory.length > 0) {
        const existingHistory = this.fallbackStorage.get(tenantId) || [];
        const combinedHistory = [...transformedHistory, ...existingHistory];
        const limitedHistory = combinedHistory.slice(0, 20);
        this.fallbackStorage.set(tenantId, limitedHistory);
      }
      return;
    }

    // Transform imported data to match our schema
    const transformedHistory = importedHistory
      .filter(entry => entry.timestamp && entry.attributes && entry.queryParams)
      .map(entry => ({
        id: entry.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: entry.timestamp,
        attributes: Array.isArray(entry.attributes) ? entry.attributes : [],
        queryParams: entry.queryParams || {},
        resultCount: entry.resultCount || 0,
        tenantId
      }));

    if (transformedHistory.length > 0) {
      // Add imported entries to existing history
      const existingHistory = await this.loadQueryHistory(tenantId);
      const combinedHistory = [...transformedHistory, ...existingHistory];
      
      // Keep only the last 20 entries
      const limitedHistory = combinedHistory.slice(0, 20);
      
      await this.saveQueryHistory(tenantId, limitedHistory);
    }
  }

  // Method to check if IndexedDB is available
  isIndexedDBAvailable(): boolean {
    return !this.useFallback && !!this.db;
  }

  // Simple property to check if database is ready
  get isReady(): boolean {
    return !!this.db;
  }

  // Method to get storage type being used
  getStorageType(): 'indexeddb' | 'fallback' {
    return this.useFallback ? 'fallback' : 'indexeddb';
  }

  // Method to force database recreation (useful for development/debugging)
  async forceDatabaseRecreation(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    // Delete the existing database
    const deleteRequest = indexedDB.deleteDatabase(this.dbName);
    
    return new Promise((resolve, reject) => {
      deleteRequest.onsuccess = () => {
        console.log('[StorageService] Database deleted successfully');
        // Reinitialize the database
        this.init().then(resolve).catch(reject);
      };
      deleteRequest.onerror = () => {
        console.error('[StorageService] Failed to delete database:', deleteRequest.error);
        reject(deleteRequest.error);
      };
    });
  }
}

export const storageService = new StorageService();
