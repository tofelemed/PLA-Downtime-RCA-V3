import {
  piIntegrationApi,
  PIConnectionDto,
  PIMappingDto,
  PISyncWatermarkDto,
  AfBindingDto,
  HistorianTagDto,
  safeJsonParse,
} from '@/services/api/piIntegrationApi';

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
  organizationId?: string;
  connectionName?: string;
  baseUrl: string;
  username?: string; // stored for dev; move to backend later
  password?: string; // DEV ONLY; move to secret vault later
  encSecretRef?: string; // placeholder for future secret vault
  assetServer?: { name: string; webId: string };
  afDatabase?: { name: string; webId: string };
  tzPolicy?: 'utc'|'local';
  autoDeltaSyncEnabled?: boolean;
  syncIntervalSec?: number; // default 300
  isActive?: boolean;
  lastSyncTime?: string;
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

export interface HistorianTagThresholds {
  warning?: number;
  alarm?: number;
}

export interface HistorianTagConfig {
  id: string;
  tenantId: string;
  name: string;
  path: string;
  webId: string;
  units?: string;
  category?: 'temperature' | 'pressure' | 'flow' | 'level' | 'power' | 'quality' | 'other' | string;
  dataType?: string;
  description?: string;
  updateInterval?: number; // seconds
  thresholds?: HistorianTagThresholds;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

type ConnectionExtras = {
  password?: string;
  assetServer?: { name: string; webId: string };
  afDatabase?: { name: string; webId: string };
  tzPolicy?: 'utc' | 'local';
  autoDeltaSyncEnabled?: boolean;
  syncIntervalSec?: number;
  encSecretRef?: string;
  lastSyncTime?: string;
};

type MappingPayload = {
  templateToEventType?: TemplateToEventType;
  attributesByTemplate?: AttributesMap;
};

const serializeConnectionExtras = (cfg: Partial<PIConnectionConfig>): string =>
  JSON.stringify({
    password: cfg.password,
    assetServer: cfg.assetServer,
    afDatabase: cfg.afDatabase,
    tzPolicy: cfg.tzPolicy,
    autoDeltaSyncEnabled: cfg.autoDeltaSyncEnabled,
    syncIntervalSec: cfg.syncIntervalSec,
    encSecretRef: cfg.encSecretRef,
    lastSyncTime: cfg.lastSyncTime,
  });

const mapConnectionDtoToConfig = (dto: PIConnectionDto): PIConnectionConfig => {
  const extras = safeJsonParse<ConnectionExtras>(dto.connectionConfig, {});
  return {
    id: dto.id,
    tenantId: dto.tenantId ?? '',
    organizationId: dto.organizationId ?? undefined,
    connectionName: dto.connectionName,
    baseUrl: dto.piWebApiUrl,
    username: dto.username ?? undefined,
    password: extras.password ?? dto.passwordEncrypted ?? undefined,
    encSecretRef: extras.encSecretRef,
    assetServer: extras.assetServer,
    afDatabase: extras.afDatabase,
    tzPolicy: extras.tzPolicy,
    autoDeltaSyncEnabled: extras.autoDeltaSyncEnabled,
    syncIntervalSec: extras.syncIntervalSec,
    isActive: dto.isActive,
    lastSyncTime: dto.lastSyncTime ?? extras.lastSyncTime,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
};

const buildConnectionPayload = (
  cfg: Omit<PIConnectionConfig, 'id' | 'createdAt' | 'updatedAt'>,
) => ({
  tenantId: cfg.tenantId,
  organizationId: cfg.organizationId,
  connectionName:
    cfg.connectionName ??
    cfg.assetServer?.name ??
    cfg.afDatabase?.name ??
    'PI Connection',
  piWebApiUrl: cfg.baseUrl,
  username: cfg.username,
  passwordEncrypted: cfg.password,
  afDatabasePath: cfg.afDatabase?.name,
  connectionConfig: serializeConnectionExtras(cfg),
  isActive: cfg.isActive ?? true,
});

const mapBindingDtoToRecord = (dto: AfBindingDto) => ({
  id: dto.id,
  tenantId: dto.tenantId,
  organizationId: dto.organizationId,
  webId: dto.webId,
  localId: dto.localId,
  boundType: dto.boundType,
  mappingConfig: safeJsonParse<Record<string, unknown>>(dto.mappingConfig, {}),
  isActive: dto.isActive,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});

const mapMappingDtoToRecord = (dto: PIMappingDto): PIMappings => {
  const payload = safeJsonParse<MappingPayload>(dto.mappingRules, {});
  return {
    id: dto.id,
    tenantId: dto.tenantId ?? '',
    templateToEventType: payload.templateToEventType ?? {},
    attributesByTemplate: payload.attributesByTemplate ?? {},
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
};

const buildMappingPayload = (
  tenantId: string,
  data: Omit<PIMappings, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
) => ({
  tenantId,
  mappingRules: JSON.stringify({
    templateToEventType: data.templateToEventType,
    attributesByTemplate: data.attributesByTemplate,
  }),
  isActive: true,
});

const mapWatermarkDtoToRecord = (dto: PISyncWatermarkDto): PISyncWatermark => ({
  id: dto.id,
  tenantId: dto.tenantId ?? '',
  scopeType: (dto.syncType as 'element' | 'database') || 'element',
  scopeId: dto.lastSyncMarker || '',
  lastEndUtc: dto.lastSyncTimestamp || new Date().toISOString(),
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});

const buildWatermarkPayload = (rec: {
  tenantId: string;
  scopeType: 'element' | 'database';
  scopeId: string;
  lastEndUtc: string;
}) => ({
  tenantId: rec.tenantId,
  syncType: rec.scopeType,
  lastSyncMarker: rec.scopeId,
  lastSyncTimestamp: rec.lastEndUtc,
});

const mapHistorianTagDtoToConfig = (dto: HistorianTagDto): HistorianTagConfig => {
  const configExtras = safeJsonParse<{ thresholds?: HistorianTagThresholds; path?: string }>(
    dto.config,
    {},
  );
  return {
    id: dto.id,
    tenantId: dto.tenantId ?? '',
    name: dto.tagName,
    path: dto.tagPath ?? configExtras.path ?? '',
    webId: dto.webId ?? '',
    units: dto.unitOfMeasure ?? undefined,
    category: dto.category ?? undefined,
    dataType: dto.dataType ?? undefined,
    description: dto.description ?? undefined,
    updateInterval: dto.updateInterval ?? undefined,
    thresholds: {
      warning: dto.warningThreshold ?? configExtras.thresholds?.warning,
      alarm: dto.alarmThreshold ?? configExtras.thresholds?.alarm,
    },
    enabled: dto.enabled,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
};

const buildHistorianTagPayload = (
  tenantId: string,
  tag: Omit<HistorianTagConfig, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
) => ({
  tenantId,
  tagName: tag.name,
  tagPath: tag.path,
  webId: tag.webId,
  unitOfMeasure: tag.units,
  category: tag.category,
  dataType: tag.dataType,
  description: tag.description,
  updateInterval: tag.updateInterval,
  warningThreshold: tag.thresholds?.warning,
  alarmThreshold: tag.thresholds?.alarm,
  enabled: tag.enabled,
  config: JSON.stringify({ thresholds: tag.thresholds }),
});

export class PIStore {
  private async replaceTenantRecords<T extends { id: string }>(
    storeName: string,
    tenantId: string,
    records: T[],
  ) {
    // Cache replacement is now handled by API calls directly
    // This method is kept for compatibility but no longer uses IndexedDB
  }

  private async syncHistorianTagsCache(tenantId: string): Promise<HistorianTagConfig[]> {
    if (!tenantId) return [];
    const apiTags = await piIntegrationApi.listHistorianTags({ tenantId });
    const mapped = apiTags.map(mapHistorianTagDtoToConfig);
    await this.replaceTenantRecords('historianTags', tenantId, mapped);
    return mapped;
  }

  private async syncWatermarksCache(tenantId: string): Promise<PISyncWatermark[]> {
    if (!tenantId) return [];
    const apiList = await piIntegrationApi.listWatermarks({ tenantId });
    const mapped = apiList.map(mapWatermarkDtoToRecord);
    await this.replaceTenantRecords('piSyncWatermarks', tenantId, mapped);
    return mapped;
  }

  async upsertConnection(cfg: Omit<PIConnectionConfig, 'id' | 'createdAt' | 'updatedAt'>) {
    const tenantId = cfg.tenantId;
    if (!tenantId) throw new Error('tenantId is required to persist PI connection settings');
    try {
      const existingApi = await piIntegrationApi.listConnections({ tenantId });
      const payload = buildConnectionPayload(cfg);
      let dto: PIConnectionDto;
      if (existingApi.length > 0) {
        dto = await piIntegrationApi.updateConnection(existingApi[0].id, payload);
      } else {
        dto = await piIntegrationApi.createConnection(payload);
      }
      const mapped = mapConnectionDtoToConfig(dto);
      await this.replaceTenantRecords('piConnections', tenantId, [mapped]);
      return mapped;
    } catch (error) {
      console.error('[PIStore] Failed to persist PI connection via API', error);
      throw error;
    }
  }

  async getConnectionByTenant(tenantId: string) {
    if (!tenantId) return null;
    try {
      const apiConnections = await piIntegrationApi.listConnections({ tenantId });
      if (apiConnections.length > 0) {
        const mapped = mapConnectionDtoToConfig(apiConnections[0]);
        await this.replaceTenantRecords('piConnections', tenantId, [mapped]);
        return mapped;
      }
    } catch (error) {
      console.error('[PIStore] Failed to fetch PI connection via API', error);
      return null;
    }
  }

  async upsertAfElements(recs: PIAfElementRecord[]) {
    // AF Elements are now managed through API calls
    // This method is kept for compatibility but no longer uses IndexedDB
  }

  async upsertEvents(events: PIEventRecord[]) {
    // Events are now managed through API calls
    // This method is kept for compatibility but no longer uses IndexedDB
  }

  async bindTenantRoot(tenantId: string, rootWebId: string) {
    if (!tenantId) throw new Error('tenantId is required to bind AF root');
    try {
      const bindings = await piIntegrationApi.listBindings({ tenantId });
      const existingTenantBinding = bindings.find((b) => b.boundType === 'tenant');
      const payload = {
        tenantId,
        boundType: 'tenant',
        webId: rootWebId,
        localId: tenantId,
        mappingConfig: JSON.stringify({}),
        isActive: true,
      };
      const dto = existingTenantBinding
        ? await piIntegrationApi.updateBinding(existingTenantBinding.id, payload)
        : await piIntegrationApi.createBinding(payload);
      const record = mapBindingDtoToRecord(dto);
      await this.listBindings(tenantId);
      return record;
    } catch (error) {
      console.error('[PIStore] Failed to bind tenant root via API', error);
      throw error;
    }
  }

  async bindNode(params: { tenantId: string; webId: string; boundType: 'unit'|'asset'; localId: string; }) {
    if (!params.tenantId) throw new Error('tenantId is required to bind AF node');
    try {
      const bindings = await piIntegrationApi.listBindings({ tenantId: params.tenantId });
      const duplicate = bindings.find(
        (b) => b.webId === params.webId && b.boundType === params.boundType,
      );
      const payload = {
        tenantId: params.tenantId,
        boundType: params.boundType,
        webId: params.webId,
        localId: params.localId,
        mappingConfig: JSON.stringify({}),
        isActive: true,
      };
      const dto = duplicate
        ? await piIntegrationApi.updateBinding(duplicate.id, payload)
        : await piIntegrationApi.createBinding(payload);
      await this.listBindings(params.tenantId);
      return mapBindingDtoToRecord(dto);
    } catch (error) {
      console.error('[PIStore] Failed to bind AF node via API', error);
      throw error;
    }
  }

  async getTenantRootBinding(tenantId: string) {
    const bindings = await this.listBindings(tenantId);
    return bindings.find((b: any) => b.boundType === 'tenant') || null;
  }

  async listBindings(tenantId: string) {
    if (!tenantId) return [];
    try {
      const apiList = await piIntegrationApi.listBindings({ tenantId });
      const mapped = apiList.map(mapBindingDtoToRecord);
      await this.replaceTenantRecords('afBindings', tenantId, mapped);
      return mapped;
    } catch (error) {
      console.error('[PIStore] Failed to load AF bindings via API', error);
      return [];
    }
  }

  async upsertMappings(tenantId: string, data: Omit<PIMappings, 'id'|'tenantId'|'createdAt'|'updatedAt'>) {
    if (!tenantId) throw new Error('tenantId is required to persist PI mappings');
    try {
      const existing = await piIntegrationApi.listMappings({ tenantId });
      const payload = buildMappingPayload(tenantId, data);
      let dto: PIMappingDto;
      if (existing.length > 0) {
        dto = await piIntegrationApi.updateMapping(existing[0].id, payload);
      } else {
        dto = await piIntegrationApi.createMapping(payload);
      }
      const mapped = mapMappingDtoToRecord(dto);
      await this.replaceTenantRecords('piMappings', tenantId, [mapped]);
      return mapped;
    } catch (error) {
      console.error('[PIStore] Failed to persist PI mappings via API', error);
      throw error;
    }
  }

  async getMappings(tenantId: string) {
    if (!tenantId) return null;
    try {
      const list = await piIntegrationApi.listMappings({ tenantId });
      if (list.length > 0) {
        const mapped = mapMappingDtoToRecord(list[0]);
        await this.replaceTenantRecords('piMappings', tenantId, [mapped]);
        return mapped;
      }
    } catch (error) {
      console.error('[PIStore] Failed to fetch PI mappings via API', error);
      return null;
    }
    return null;
  }

  async setWatermark(rec: { tenantId: string; scopeType: 'element'|'database'; scopeId: string; lastEndUtc: string }) {
    if (!rec.tenantId) throw new Error('tenantId is required to persist PI sync watermark');
    try {
      const existing = await piIntegrationApi.listWatermarks({ tenantId: rec.tenantId });
      const match = existing.find(
        (w) =>
          ((w.syncType as 'element' | 'database') || 'element') === rec.scopeType &&
          (w.lastSyncMarker || '') === rec.scopeId,
      );
      const payload = buildWatermarkPayload(rec);
      if (match) {
        await piIntegrationApi.updateWatermark(match.id, payload);
      } else {
        await piIntegrationApi.createWatermark(payload);
      }
      const refreshed = await this.syncWatermarksCache(rec.tenantId);
      return refreshed.find(
        (w) => w.scopeType === rec.scopeType && w.scopeId === rec.scopeId,
      ) || null;
    } catch (error) {
      console.error('[PIStore] Failed to persist PI watermark via API', error);
      throw error;
    }
  }

  async getWatermark(tenantId: string, scopeType: 'element'|'database', scopeId: string) {
    if (!tenantId) return null;
    try {
      const cached = await this.syncWatermarksCache(tenantId);
      return (
        cached.find(
          (w) => w.scopeType === scopeType && (w.scopeId === scopeId || (w as any).scopeWebId === scopeId),
        ) || null
      );
    } catch (error) {
      console.error('[PIStore] Failed to fetch PI watermark via API', error);
      return null;
    }
  }

  async getPIStats() {
    // PI Events stats are now managed through API calls
    // This method is kept for compatibility but no longer uses IndexedDB
    return { total: 0, byTemplate: {} };
  }

  async listPIEventsByTenant(tenantId: string) {
    // PI Events are now managed through API calls
    // This method is kept for compatibility but no longer uses IndexedDB
    return [];
  }

  async getPIEventById(efId: string) {
    // PI Events are now managed through API calls
    // This method is kept for compatibility but no longer uses IndexedDB
    return null;
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
  async upsertHistorianTags(
    tenantId: string,
    tags: Omit<HistorianTagConfig, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>[],
  ): Promise<void> {
    if (!tenantId) throw new Error('tenantId is required to persist historian tags');
    try {
      const existing = await piIntegrationApi.listHistorianTags({ tenantId });
      await Promise.all(existing.map((tag) => piIntegrationApi.deleteHistorianTag(tag.id)));
      for (const tag of tags) {
        await piIntegrationApi.createHistorianTag(buildHistorianTagPayload(tenantId, tag));
      }
      await this.syncHistorianTagsCache(tenantId);
      console.log('[PIStore] Historian tags persisted via API');
    } catch (error) {
      console.error('[PIStore] Failed to persist historian tags via API', error);
      throw error;
    }
  }

  async getHistorianTags(tenantId: string): Promise<HistorianTagConfig[]> {
    if (!tenantId) return [];
    try {
      return await this.syncHistorianTagsCache(tenantId);
    } catch (error) {
      console.error('[PIStore] Failed to load historian tags via API', error);
      return [];
    }
  }

  async deleteHistorianTag(tagId: string): Promise<void> {
    try {
      const tag = await piIntegrationApi.getHistorianTag(tagId);
      await piIntegrationApi.deleteHistorianTag(tagId);
      if (tag?.tenantId) {
        await this.syncHistorianTagsCache(tag.tenantId);
      }
    } catch (error) {
      console.error('[PIStore] Failed to delete historian tag via API', error);
      throw error;
    }
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

