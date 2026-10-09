import { appSettingsApi } from './api/appSettingsApi';
import { createLogger } from '@/lib/logger';

/**
 * Event Hub tab visibility per user and tenant, stored server-side in app-settings (plan 3.1 step 7:
 * IndexedDB is out of product paths). Same interface as before, so the Event Hub is unchanged.
 */
const log = createLogger('TabVisibility');

export interface TabVisibilitySettings {
  userId: string;
  tenantId: string;
  visibleTabs: {
    ProductionLoss: boolean;
    IOW: boolean;
    SOL: boolean;
    APM: boolean;
    FailureWO: boolean;
    ProductionOutput: boolean;
  };
  updatedAt: string;
}

export const defaultTabVisibility = {
  ProductionLoss: true,
  IOW: true,
  SOL: true,
  APM: true,
  FailureWO: true,
  ProductionOutput: true,
};

type VisibleTabs = TabVisibilitySettings['visibleTabs'];

export function tabVisibilityKey(userId: string, tenantId: string): string {
  return `tabVisibility.${tenantId}.${userId}`;
}

function defaults(userId: string, tenantId: string): TabVisibilitySettings {
  return { userId, tenantId, visibleTabs: { ...defaultTabVisibility }, updatedAt: new Date().toISOString() };
}

class TabVisibilityService {
  async getVisibilitySettings(userId: string, tenantId: string): Promise<TabVisibilitySettings> {
    try {
      const stored = await appSettingsApi.getValue<Partial<TabVisibilitySettings> | null>(
        tabVisibilityKey(userId, tenantId),
        null,
      );
      if (!stored?.visibleTabs) return defaults(userId, tenantId);
      return {
        userId,
        tenantId,
        visibleTabs: { ...defaultTabVisibility, ...(stored.visibleTabs as Partial<VisibleTabs>) },
        updatedAt: stored.updatedAt ?? new Date().toISOString(),
      };
    } catch (error) {
      log.warn('Could not load tab visibility; showing every tab', error);
      return defaults(userId, tenantId);
    }
  }

  async saveVisibilitySettings(settings: TabVisibilitySettings): Promise<void> {
    await appSettingsApi.setValue(tabVisibilityKey(settings.userId, settings.tenantId), {
      ...settings,
      updatedAt: new Date().toISOString(),
    });
  }

  async toggleTab(
    userId: string,
    tenantId: string,
    tabName: keyof typeof defaultTabVisibility,
    visible: boolean,
  ): Promise<void> {
    const settings = await this.getVisibilitySettings(userId, tenantId);
    settings.visibleTabs[tabName] = visible;
    await this.saveVisibilitySettings(settings);
  }

  async resetToDefaults(userId: string, tenantId: string): Promise<void> {
    await this.saveVisibilitySettings(defaults(userId, tenantId));
  }
}

export const tabVisibilityService = new TabVisibilityService();
