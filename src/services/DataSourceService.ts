import { dataSourceApi, DataSourceDto, CreateDataSourcePayload, UpdateDataSourcePayload } from './api/dataSourceApi';

export interface ConnectivityDataSource {
  id: string;
  remoteId?: string;
  tenantId?: string;
  organizationId?: string;
  sourceName: string;
  type?: string;
  connectionString?: string;
  credentialsEncrypted?: string;
  status?: string;
  enabled: boolean;
  lastSyncTime?: string;
  config?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const parseJson = <T>(value?: string | null, fallback?: T): T | undefined => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const mapDtoToRecord = (dto: DataSourceDto): ConnectivityDataSource => ({
  id: dto.id,
  remoteId: dto.id,
  tenantId: dto.tenantId,
  organizationId: dto.organizationId,
  sourceName: dto.sourceName,
  type: dto.type,
  connectionString: dto.connectionString,
  credentialsEncrypted: dto.credentialsEncrypted,
  status: dto.status,
  enabled: dto.enabled,
  lastSyncTime: dto.lastSyncTime,
  config: parseJson<Record<string, any>>(dto.config),
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
});

class DataSourceService {
  async list(params?: { tenantId?: string; organizationId?: string }) {
    const dtos = await dataSourceApi.list(params);
    return dtos.map(mapDtoToRecord);
  }

  async get(id: string) {
    const dto = await dataSourceApi.get(id);
    return mapDtoToRecord(dto);
  }

  async create(payload: CreateDataSourcePayload) {
    const dto = await dataSourceApi.create(payload);
    return mapDtoToRecord(dto);
  }

  async update(id: string, updates: UpdateDataSourcePayload) {
    const dto = await dataSourceApi.update(id, updates);
    return mapDtoToRecord(dto);
  }

  async remove(id: string) {
    await dataSourceApi.delete(id);
  }
}

export const dataSourceService = new DataSourceService();


