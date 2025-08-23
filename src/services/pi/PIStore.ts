import { storageService } from '@/services/StorageService';

export type TemplateToEventType = Record<string, 'ProductionLoss'|'IOW'|'SOL'|'APM'|'FailureWO'|'ProductionOutput'>;
export type AttributesMap = Record<string, Record<string, string>>; // template -> (EF attr name -> app field key)
export interface PIMappings {
  id: string;
  tenantId: string;
  templateToEventType: TemplateToEventType;
  attributesByTemplate: AttributesMap;
  createdAt: string;
  updatedAt: string;
}

export interface PIConnectionConfig {
  id: string;
  tenantId: string;
  baseUrl: string;
  username: string; // stored for dev; move to backend later
  password?: string; // DEV ONLY; move to secret vault later
  encSecretRef?: string; // placeholder for future secret vault
  assetServer?: { name: string; webId: string };
  afDatabase?: { name: string; webId: string };
  tzPolicy?: 'utc'|'local';
  autoDeltaSyncEnabled?: boolean;
  syncIntervalSec?: number; // default 300
  createdAt: string;
  updatedAt: string;
}

export interface PIAfElementRecord {
  id: string; // webId
  name: string;
  afPath?: string;
  template?: string;
  categories?: string[];
  parentId?: string;
  level?: number;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PIEventRecord {
  id: string; // event frame webId
  efId: string; // alias of webId
  template?: string;
  name: string;
  startUtc: string;
  endUtc?: string;
  primaryAfId?: string; // AF element webId
  attributes: Record<string, any>;
  lastModifiedUtc?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PISyncWatermark {
  id: string;
  tenantId: string;
  scopeType: 'element'|'database';
  scopeId: string; // AF element or database WebId used for sync
  lastEndUtc: string; // last synced end time
  createdAt: string;
  updatedAt: string;
}

export interface HistorianTagConfig {
  id: string;
  name: string;
  path: string;
  webId: string;
  units: string;
  category: 'temperature' | 'pressure' | 'flow' | 'level' | 'power' | 'quality' | 'other';
  updateInterval: number; // seconds
  thresholds?: {
    warning?: number;
    alarm?: number;
  };
  enabled: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export class PIStore {
  async upsertConnection(cfg: Omit<PIConnectionConfig, 'id'|'createdAt'|'updatedAt'>) {
    const existingList = await storageService.query<PIConnectionConfig>('piConnections', { tenantId: cfg.tenantId });
    const now = new Date().toISOString();
    if (existingList && existingList.length > 0) {
      const existing = existingList[0];
      return storageService.update<PIConnectionConfig>('piConnections', existing.id, { ...existing, ...cfg, updatedAt: now } as any);
    }
    return storageService.create<PIConnectionConfig>('piConnections', { ...(cfg as any), createdAt: now, updatedAt: now });
  }

  async getConnectionByTenant(tenantId: string) {
    const existingList = await storageService.query<PIConnectionConfig>('piConnections', { tenantId });
    return existingList && existingList.length > 0 ? existingList[0] : null;
  }

  async upsertAfElements(recs: PIAfElementRecord[]) {
    for (const rec of recs) {
      const existing = await storageService.get<PIAfElementRecord>('piAfElements', rec.id);
      if (existing) {
        await storageService.update<PIAfElementRecord>('piAfElements', rec.id, { ...rec, updatedAt: new Date().toISOString() });
      } else {
        await storageService.create<PIAfElementRecord>('piAfElements', rec);
      }
    }
  }

  async upsertEvents(events: PIEventRecord[]) {
    for (const ev of events) {
      const existing = await storageService.get<PIEventRecord>('piEvents', ev.id);
      if (existing) {
        await storageService.update<PIEventRecord>('piEvents', ev.id, { ...ev, updatedAt: new Date().toISOString() });
      } else {
        await storageService.create<PIEventRecord>('piEvents', ev);
      }
    }
  }

  async bindTenantRoot(tenantId: string, rootWebId: string) {
    // Remove previous tenant binding if exists
    const existing = await storageService.query<any>('afBindings', { tenantId });
    for (const b of existing) {
      if (b.boundType === 'tenant') {
        await storageService.delete('afBindings', b.id);
      }
    }
    return storageService.create<any>('afBindings', {
      tenantId,
      webId: rootWebId,
      boundType: 'tenant',
      localId: tenantId,
    });
  }

  async bindNode(params: { tenantId: string; webId: string; boundType: 'unit'|'asset'; localId: string; }) {
    // Ensure uniqueness per webId + boundType in this tenant
    const list = await storageService.query<any>('afBindings', { tenantId: params.tenantId });
    for (const b of list) {
      if (b.webId === params.webId && b.boundType === params.boundType) {
        await storageService.delete('afBindings', b.id);
      }
    }
    return storageService.create<any>('afBindings', params as any);
  }

  async getTenantRootBinding(tenantId: string) {
    const list = await storageService.query<any>('afBindings', { tenantId });
    return list.find(b => b.boundType === 'tenant') || null;
  }

  async listBindings(tenantId: string) {
    return storageService.query<any>('afBindings', { tenantId });
  }

  async upsertMappings(tenantId: string, data: Omit<PIMappings, 'id'|'tenantId'|'createdAt'|'updatedAt'>) {
    const existing = await storageService.query<PIMappings>('piMappings', { tenantId });
    const now = new Date().toISOString();
    if (existing && existing.length > 0) {
      const rec = existing[0];
      return storageService.update<PIMappings>('piMappings', rec.id, { ...rec, ...data, updatedAt: now } as any);
    }
    return storageService.create<PIMappings>('piMappings', { tenantId, ...(data as any), createdAt: now, updatedAt: now });
  }

  async getMappings(tenantId: string) {
    const list = await storageService.query<PIMappings>('piMappings', { tenantId });
    return list && list.length > 0 ? list[0] : null;
  }

  async setWatermark(rec: { tenantId: string; scopeType: 'element'|'database'; scopeId: string; lastEndUtc: string }) {
    const existing = await storageService.query<PISyncWatermark>('piSyncWatermarks', { tenantId: rec.tenantId });
    const found = existing.find(x => (x.scopeId === (x as any).scopeWebId /* legacy */ || x.scopeId === rec.scopeId) && (x.scopeType || 'element') === rec.scopeType);
    if (found) {
      return storageService.update<PISyncWatermark>('piSyncWatermarks', found.id, { ...found, scopeType: rec.scopeType, scopeId: rec.scopeId, lastEndUtc: rec.lastEndUtc } as any);
    }
    return storageService.create<PISyncWatermark>('piSyncWatermarks', rec as any);
  }

  async getWatermark(tenantId: string, scopeType: 'element'|'database', scopeId: string) {
    const existing = await storageService.query<PISyncWatermark>('piSyncWatermarks', { tenantId });
    return existing.find(x => (x.scopeType || 'element') === scopeType && (x.scopeId === scopeId || (x as any).scopeWebId === scopeId)) || null;
  }

  async getPIStats() {
    const items = await storageService.query<PIEventRecord>('piEvents');
    const byTemplate: Record<string, number> = {};
    for (const it of items) {
      const key = it.template || 'Unknown';
      byTemplate[key] = (byTemplate[key] || 0) + 1;
    }
    return { total: items.length, byTemplate };
  }

  async listPIEventsByTenant(tenantId: string) {
    return storageService.query<PIEventRecord>('piEvents', { tenantId });
  }

  async getPIEventById(efId: string) {
    return storageService.get<PIEventRecord>('piEvents', efId);
  }

  async getTemplatesForTenant(tenantId: string) {
    const items = await this.listPIEventsByTenant(tenantId);
    const templateSet = new Set<string>();
    const efIdToTemplate: Record<string, string> = {};
    for (const it of items) {
      if (it.template) {
        templateSet.add(it.template);
        efIdToTemplate[it.efId] = it.template;
      }
    }
    return { templates: Array.from(templateSet).sort(), efIdToTemplate };
  }

  // --- Historian Tags Management ---
  async upsertHistorianTags(tenantId: string, tags: Omit<HistorianTagConfig, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    const now = new Date().toISOString();
    
    console.log('[PIStore] upsertHistorianTags called with tenantId:', tenantId, 'tags:', tags);
    
    // First, delete all existing tags for this tenant to replace them completely
    const existingTags = await this.getHistorianTags(tenantId);
    console.log('[PIStore] Existing tags to delete:', existingTags);
    
    for (const existingTag of existingTags) {
      await storageService.delete('historianTags', existingTag.id);
    }
    
    // Create new tags
    for (const tag of tags) {
      const newTag = await storageService.create<HistorianTagConfig>('historianTags', {
        ...tag,
        tenantId,
        createdAt: now,
        updatedAt: now
      } as any);
      console.log('[PIStore] Created new tag:', newTag);
    }
    
    console.log('[PIStore] upsertHistorianTags completed');
  }

  async getHistorianTags(tenantId: string): Promise<HistorianTagConfig[]> {
    console.log('[PIStore] getHistorianTags called with tenantId:', tenantId);
    const tags = await storageService.query<HistorianTagConfig>('historianTags', { tenantId });
    console.log('[PIStore] getHistorianTags result:', tags);
    return tags || [];
  }

  async deleteHistorianTag(tagId: string): Promise<void> {
    await storageService.delete('historianTags', tagId);
  }

  async forceDatabaseUpgrade(): Promise<void> {
    console.log('[PIStore] Force database upgrade called');
    try {
      // Try to force a database refresh by clearing the database
      // This is a more aggressive approach to ensure the upgrade runs
      if (typeof indexedDB !== 'undefined') {
        const dbName = 'ProActDB';
        const request = indexedDB.deleteDatabase(dbName);
        
        request.onsuccess = () => {
          console.log('[PIStore] Database deleted successfully, will be recreated on next page reload');
        };
        
        request.onerror = () => {
          console.error('[PIStore] Failed to delete database:', request.error);
        };
        
        request.onblocked = () => {
          console.warn('[PIStore] Database deletion blocked - may need to close other tabs');
        };
      }
      
      console.log('[PIStore] Database upgrade initiated - please refresh the page');
    } catch (error) {
      console.error('[PIStore] Force database upgrade failed:', error);
      throw error;
    }
  }
}

export const piStore = new PIStore();

