import { httpClient } from './httpClient';

export interface DataSourceDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  sourceName: string;
  type?: string;
  connectionString?: string;
  credentialsEncrypted?: string;
  status?: string;
  enabled: boolean;
  lastSyncTime?: string;
  config?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateDataSourcePayload = Omit<
  DataSourceDto,
  'id' | 'createdAt' | 'updatedAt' | 'config'
> & {
  config?: Record<string, any>;
};

export type UpdateDataSourcePayload = Partial<CreateDataSourcePayload>;

const serializeConfig = (value?: Record<string, any> | string) =>
  typeof value === 'string' ? value : value ? JSON.stringify(value) : undefined;

const normalizePayload = (payload: CreateDataSourcePayload | UpdateDataSourcePayload) => ({
  ...payload,
  config: serializeConfig(payload.config as any),
});

export const dataSourceApi = {
  async list(params?: { tenantId?: string; organizationId?: string; type?: string; status?: string; enabled?: boolean }) {
    const response = await httpClient.get<DataSourceDto[]>('/data-sources', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await httpClient.get<DataSourceDto>(`/data-sources/${id}`);
    return response.data;
  },

  async create(payload: CreateDataSourcePayload) {
    const response = await httpClient.post<DataSourceDto>('/data-sources', normalizePayload(payload));
    return response.data;
  },

  async update(id: string, payload: UpdateDataSourcePayload) {
    const response = await httpClient.patch<DataSourceDto>(`/data-sources/${id}`, normalizePayload(payload));
    return response.data;
  },

  async delete(id: string) {
    await httpClient.delete(`/data-sources/${id}`);
  },
};


