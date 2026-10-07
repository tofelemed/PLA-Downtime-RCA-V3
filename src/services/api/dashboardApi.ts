import { httpClient } from './httpClient';

export interface DashboardConfigurationDto {
  id: string;
  tenantId: string;
  oee: string;
  losses: string;
  costs: string;
  bottleneckRisk: string;
  display: string;
  performance: string;
  quality: string;
  availability: string;
  isActive: boolean;
  version: number;
  lastModifiedBy?: string | null;
  lastModifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DashboardConfigurationPayload = Partial<
  Omit<
    DashboardConfigurationDto,
    'id' | 'createdAt' | 'updatedAt'
  >
>;

export const dashboardApi = {
  async list(params?: { tenantId?: string; active?: boolean; version?: number }) {
    const response = await httpClient.get<DashboardConfigurationDto[]>('/dashboard-configurations', {
      params: {
        tenantId: params?.tenantId,
        active: params?.active,
        version: params?.version,
      },
    });
    return response.data;
  },

  async get(id: string) {
    const response = await httpClient.get<DashboardConfigurationDto>(`/dashboard-configurations/${id}`);
    return response.data;
  },

  async create(payload: DashboardConfigurationPayload) {
    const response = await httpClient.post<DashboardConfigurationDto>('/dashboard-configurations', payload);
    return response.data;
  },

  async update(id: string, payload: DashboardConfigurationPayload) {
    const response = await httpClient.put<DashboardConfigurationDto>(`/dashboard-configurations/${id}`, payload);
    return response.data;
  },

  async delete(id: string) {
    await httpClient.delete(`/dashboard-configurations/${id}`);
  },
};


