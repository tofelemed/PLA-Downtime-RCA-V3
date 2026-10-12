import { httpClient } from './httpClient';

export interface PIConnectionDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  connectionName: string;
  piWebApiUrl: string;
  username?: string;
  passwordEncrypted?: string;
  afDatabasePath?: string;
  connectionConfig?: string;
  isActive: boolean;
  lastSyncTime?: string;
  createdAt: string;
  updatedAt: string;
}

/** Body of POST / PATCH `/pi-connections`: id, timestamps and `lastSyncTime` are server-managed. */
export type PIConnectionWritePayload = Partial<
  Omit<PIConnectionDto, 'id' | 'lastSyncTime' | 'createdAt' | 'updatedAt'>
>;

export interface PIAfElementDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  webId?: string;
  name?: string;
  description?: string;
  path?: string;
  template?: string;
  categories?: string;
  parentId?: string;
  hierarchyLevel?: number;
  lastSeenAt?: string;
  hasChildren: boolean;
  metadata?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PIEventDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  webId?: string;
  name?: string;
  template?: string;
  primaryAfId?: string;
  startUtc?: string;
  endUtc?: string;
  acknowledged: boolean;
  eventData?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PIMappingDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  sourceType?: string;
  sourceId?: string;
  targetType?: string;
  targetId?: string;
  mappingRules?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AfBindingDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  webId?: string;
  localId?: string;
  boundType?: string;
  mappingConfig?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PISyncWatermarkDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  syncType?: string;
  lastSyncTimestamp?: string;
  lastSyncMarker?: string;
  syncStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PISyncJobDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  jobName?: string;
  jobType?: string;
  schedule?: string;
  lastRunTime?: string;
  nextRunTime?: string;
  status?: string;
  errorMessage?: string;
  jobConfig?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HistorianTagDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  webId?: string;
  tagName: string;
  tagPath?: string;
  description?: string;
  category?: string;
  unitOfMeasure?: string;
  dataType?: string;
  updateInterval?: number;
  warningThreshold?: number;
  alarmThreshold?: number;
  enabled: boolean;
  config?: string;
  createdAt: string;
  updatedAt: string;
}

export const piIntegrationApi = {
  // Connections
  async listConnections(params?: { tenantId?: string; organizationId?: string }) {
    const response = await httpClient.get<PIConnectionDto[]>('/pi-connections', { params });
    return response.data;
  },
  async createConnection(payload: PIConnectionWritePayload) {
    const response = await httpClient.post<PIConnectionDto>('/pi-connections', payload);
    return response.data;
  },
  async updateConnection(id: string, payload: PIConnectionWritePayload) {
    const response = await httpClient.patch<PIConnectionDto>(`/pi-connections/${id}`, payload);
    return response.data;
  },
  async deleteConnection(id: string) {
    await httpClient.delete(`/pi-connections/${id}`);
  },

  // AF Elements
  async listAfElements(params?: { tenantId?: string; organizationId?: string; parentId?: string; template?: string; webId?: string }) {
    const response = await httpClient.get<PIAfElementDto[]>('/pi-af-elements', { params });
    return response.data;
  },
  async createAfElement(payload: Partial<PIAfElementDto>) {
    const response = await httpClient.post<PIAfElementDto>('/pi-af-elements', payload);
    return response.data;
  },
  async updateAfElement(id: string, payload: Partial<PIAfElementDto>) {
    const response = await httpClient.patch<PIAfElementDto>(`/pi-af-elements/${id}`, payload);
    return response.data;
  },
  async deleteAfElement(id: string) {
    await httpClient.delete(`/pi-af-elements/${id}`);
  },

  // PI Events
  async listEvents(params?: { tenantId?: string; organizationId?: string; template?: string; primaryAfId?: string; startUtc?: string; webId?: string }) {
    const response = await httpClient.get<PIEventDto[]>('/pi-events', { params });
    return response.data;
  },
  async createEvent(payload: Partial<PIEventDto>) {
    const response = await httpClient.post<PIEventDto>('/pi-events', payload);
    return response.data;
  },
  async updateEvent(id: string, payload: Partial<PIEventDto>) {
    const response = await httpClient.patch<PIEventDto>(`/pi-events/${id}`, payload);
    return response.data;
  },
  async deleteEvent(id: string) {
    await httpClient.delete(`/pi-events/${id}`);
  },

  // PI mappings
  async listMappings(params?: { tenantId?: string; organizationId?: string; sourceType?: string; targetType?: string }) {
    const response = await httpClient.get<PIMappingDto[]>('/pi-mappings', { params });
    return response.data;
  },
  async createMapping(payload: Partial<PIMappingDto>) {
    const response = await httpClient.post<PIMappingDto>('/pi-mappings', payload);
    return response.data;
  },
  async updateMapping(id: string, payload: Partial<PIMappingDto>) {
    const response = await httpClient.patch<PIMappingDto>(`/pi-mappings/${id}`, payload);
    return response.data;
  },
  async deleteMapping(id: string) {
    await httpClient.delete(`/pi-mappings/${id}`);
  },

  // AF bindings
  async listBindings(params?: { tenantId?: string; organizationId?: string; boundType?: string }) {
    const response = await httpClient.get<AfBindingDto[]>('/af-bindings', { params });
    return response.data;
  },
  async createBinding(payload: Partial<AfBindingDto>) {
    const response = await httpClient.post<AfBindingDto>('/af-bindings', payload);
    return response.data;
  },
  async updateBinding(id: string, payload: Partial<AfBindingDto>) {
    const response = await httpClient.patch<AfBindingDto>(`/af-bindings/${id}`, payload);
    return response.data;
  },
  async deleteBinding(id: string) {
    await httpClient.delete(`/af-bindings/${id}`);
  },

  // Sync watermarks
  async listWatermarks(params?: { tenantId?: string; organizationId?: string; syncType?: string }) {
    const response = await httpClient.get<PISyncWatermarkDto[]>('/pi-sync-watermarks', { params });
    return response.data;
  },
  async createWatermark(payload: Partial<PISyncWatermarkDto>) {
    const response = await httpClient.post<PISyncWatermarkDto>('/pi-sync-watermarks', payload);
    return response.data;
  },
  async updateWatermark(id: string, payload: Partial<PISyncWatermarkDto>) {
    const response = await httpClient.patch<PISyncWatermarkDto>(`/pi-sync-watermarks/${id}`, payload);
    return response.data;
  },
  async deleteWatermark(id: string) {
    await httpClient.delete(`/pi-sync-watermarks/${id}`);
  },

  // Sync jobs
  async listSyncJobs(params?: { tenantId?: string; organizationId?: string; enabled?: boolean }) {
    const query: Record<string, any> = { ...params };
    if (query.enabled !== undefined) {
      query.status = query.enabled ? 'enabled' : 'disabled';
      delete query.enabled;
    }
    const response = await httpClient.get<PISyncJobDto[]>('/pi-sync-jobs', { params: query });
    return response.data;
  },
  async createSyncJob(payload: Partial<PISyncJobDto>) {
    const response = await httpClient.post<PISyncJobDto>('/pi-sync-jobs', payload);
    return response.data;
  },
  async updateSyncJob(id: string, payload: Partial<PISyncJobDto>) {
    const response = await httpClient.patch<PISyncJobDto>(`/pi-sync-jobs/${id}`, payload);
    return response.data;
  },
  async deleteSyncJob(id: string) {
    await httpClient.delete(`/pi-sync-jobs/${id}`);
  },
  async runSyncJob(id: string) {
    return httpClient.request<{ success: boolean; message: string }>(`pi-sync-jobs/${id}/run`, {
      method: 'POST',
    });
  },

  // Historian tags
  async listHistorianTags(params?: { tenantId?: string; organizationId?: string; category?: string; enabled?: boolean }) {
    const response = await httpClient.get<HistorianTagDto[]>('/historian-tags', { params });
    return response.data;
  },
  async createHistorianTag(payload: Partial<HistorianTagDto>) {
    const response = await httpClient.post<HistorianTagDto>('/historian-tags', payload);
    return response.data;
  },
  async updateHistorianTag(id: string, payload: Partial<HistorianTagDto>) {
    const response = await httpClient.patch<HistorianTagDto>(`/historian-tags/${id}`, payload);
    return response.data;
  },
  async deleteHistorianTag(id: string) {
    await httpClient.delete(`/historian-tags/${id}`);
  },
};

export function safeJsonParse<T>(value?: string | null, fallback: T = {} as T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

