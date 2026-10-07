import { httpClient } from './httpClient';

export interface AppSettingDto {
  key: string;
  value: any;
}

export const appSettingsApi = {
  async list() {
    return httpClient.request<AppSettingDto[]>('app-settings', { method: 'GET' });
  },

  async get(key: string) {
    return httpClient.request<AppSettingDto>(`app-settings/${key}`, { method: 'GET' });
  },

  async create(payload: AppSettingDto) {
    return httpClient.request<AppSettingDto>('app-settings', {
      method: 'POST',
      body: payload,
    });
  },

  async update(key: string, payload: Partial<AppSettingDto>) {
    return httpClient.request<AppSettingDto>(`app-settings/${key}`, {
      method: 'PUT',
      body: payload,
    });
  },

  async delete(key: string) {
    return httpClient.request<void>(`app-settings/${key}`, { method: 'DELETE' });
  },

  async getValue<T = any>(key: string, defaultValue?: T): Promise<T> {
    try {
      const result = await httpClient.request<T>(`app-settings/${key}/value`, { method: 'GET' });
      return result === undefined || result === null ? (defaultValue as T) : result;
    } catch (error) {
      return defaultValue as T;
    }
  },

  async setValue<T = any>(key: string, value: T) {
    return httpClient.request<AppSettingDto>(`app-settings/${key}/value`, {
      method: 'POST',
      body: { value },
    });
  },
};


