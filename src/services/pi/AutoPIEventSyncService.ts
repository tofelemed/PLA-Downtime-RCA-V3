// PI Event Auto-Sync — backend-scheduled via pi-sync-jobs cron (no browser timers)

import { piIntegrationApi, PISyncJobDto, safeJsonParse } from '../api/piIntegrationApi';
import { piBrowserApi } from '../api/piBrowserApi';

export interface SyncJobConfig {
  id: string;
  tenantId: string;
  enabled: boolean;
  intervalMinutes: number;
  lookbackMinutes: number;
  autoStart: boolean;
  scopeType?: 'database' | 'element';
  scopeId?: string;
  lastRun?: string;
  lastSuccess?: string;
  lastError?: string;
  nextRun?: string;
  syncedEventCount: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncResult {
  success: boolean;
  eventsFetched: number;
  eventsCreated: number;
  eventsUpdated: number;
  unmappedEvents: number;
  errors: string[];
  duration: number;
  timestamp: string;
}

type SyncJobExtras = {
  intervalMinutes?: number;
  lookbackMinutes?: number;
  autoStart?: boolean;
  scopeType?: 'database' | 'element';
  scopeId?: string;
  syncedEventCount?: number;
  errorCount?: number;
  lastRun?: string;
  lastSuccess?: string;
  lastError?: string;
  nextRun?: string;
};

const serializeSyncJobExtras = (config: SyncJobConfig) =>
  JSON.stringify({
    intervalMinutes: config.intervalMinutes,
    lookbackMinutes: config.lookbackMinutes,
    autoStart: config.autoStart,
    scopeType: config.scopeType,
    scopeId: config.scopeId,
    syncedEventCount: config.syncedEventCount,
    errorCount: config.errorCount,
    lastRun: config.lastRun,
    lastSuccess: config.lastSuccess,
    lastError: config.lastError,
    nextRun: config.nextRun,
  });

const mapSyncJobDtoToConfig = (dto: PISyncJobDto): SyncJobConfig => {
  const extras = safeJsonParse<SyncJobExtras>(dto.jobConfig, {});
  return {
    id: dto.id,
    tenantId: dto.tenantId ?? '',
    enabled: dto.isActive ?? extras.autoStart ?? false,
    intervalMinutes: extras.intervalMinutes ?? 15,
    lookbackMinutes: extras.lookbackMinutes ?? 60,
    autoStart: extras.autoStart ?? true,
    scopeType: extras.scopeType,
    scopeId: extras.scopeId,
    lastRun: extras.lastRun ?? dto.lastRunTime ?? undefined,
    lastSuccess: extras.lastSuccess ?? undefined,
    lastError: extras.lastError ?? dto.errorMessage ?? undefined,
    nextRun: extras.nextRun ?? dto.nextRunTime ?? undefined,
    syncedEventCount: extras.syncedEventCount ?? 0,
    errorCount: extras.errorCount ?? 0,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
};

const buildSyncJobPayload = (config: SyncJobConfig) => ({
  tenantId: config.tenantId,
  jobName: 'PI Event Auto Sync',
  jobType: 'pi-event-sync',
  schedule: config.intervalMinutes ? `*/${config.intervalMinutes} * * * *` : undefined,
  lastRunTime: config.lastRun,
  nextRunTime: config.nextRun,
  errorMessage: config.lastError,
  status: config.enabled ? 'enabled' : 'disabled',
  jobConfig: serializeSyncJobExtras(config),
  isActive: config.enabled,
});

class AutoPIEventSyncService {
  private static instance: AutoPIEventSyncService;

  static getInstance(): AutoPIEventSyncService {
    if (!AutoPIEventSyncService.instance) {
      AutoPIEventSyncService.instance = new AutoPIEventSyncService();
    }
    return AutoPIEventSyncService.instance;
  }

  /** Enable/disable sync — backend cron executes scheduled jobs */
  async startSync(tenantId: string, config?: Partial<SyncJobConfig>): Promise<void> {
    let jobConfig = await this.getSyncJobConfig(tenantId);
    if (!jobConfig) {
      jobConfig = await this.createSyncJobConfig(tenantId, { enabled: true, ...config });
    } else {
      jobConfig = await this.updateSyncJobConfig(tenantId, { enabled: true, ...config });
    }
    console.log(`✅ PI auto-sync enabled for tenant ${tenantId} (backend cron every ${jobConfig.intervalMinutes}m)`);
  }

  /** Disable sync — no browser timer to stop */
  stopSync(_tenantId: string): void {
    console.log('⏹️ PI auto-sync disabled (backend cron will skip inactive jobs)');
  }

  async runSync(tenantId: string): Promise<SyncResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      const result = await piBrowserApi.triggerSync(tenantId, {
        autoCreateProductionEvents: true,
        maxCount: 500,
      });

      const config = await this.getSyncJobConfig(tenantId);
      if (config) {
        await this.updateSyncJobConfig(tenantId, {
          lastRun: timestamp,
          lastSuccess: result.success ? timestamp : config.lastSuccess,
          lastError: result.success ? undefined : result.errors.join('; '),
          syncedEventCount: (config.syncedEventCount || 0) + (result.productionEventsCreated || 0),
          errorCount: result.success ? config.errorCount : config.errorCount + 1,
        });
      }

      return {
        success: result.success,
        eventsFetched: result.eventsFetched,
        eventsCreated: result.productionEventsCreated,
        eventsUpdated: result.productionEventsUpdated || 0,
        unmappedEvents: result.unmappedEventsCreated || 0,
        errors: result.errors || [],
        duration: Date.now() - startTime,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        eventsFetched: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        unmappedEvents: 0,
        errors: [error.message || 'Sync failed'],
        duration: Date.now() - startTime,
        timestamp,
      };
    }
  }

  async getSyncJobConfig(tenantId: string): Promise<SyncJobConfig | null> {
    try {
      const apiJobs = await piIntegrationApi.listSyncJobs({ tenantId });
      if (apiJobs.length > 0) return mapSyncJobDtoToConfig(apiJobs[0]);
    } catch (error) {
      console.error('Failed to get sync job config from API', error);
    }
    return null;
  }

  async createSyncJobConfig(tenantId: string, config?: Partial<SyncJobConfig>): Promise<SyncJobConfig> {
    const jobConfig: SyncJobConfig = {
      id: `sync-job-${tenantId}-${Date.now()}`,
      tenantId,
      enabled: config?.enabled ?? false,
      intervalMinutes: config?.intervalMinutes ?? 15,
      lookbackMinutes: config?.lookbackMinutes ?? 60,
      autoStart: config?.autoStart ?? true,
      syncedEventCount: 0,
      errorCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dto = await piIntegrationApi.createSyncJob(buildSyncJobPayload(jobConfig));
    return mapSyncJobDtoToConfig(dto);
  }

  async updateSyncJobConfig(tenantId: string, updates: Partial<SyncJobConfig>): Promise<SyncJobConfig> {
    const config = await this.getSyncJobConfig(tenantId);
    if (!config) {
      throw new Error(`No sync job config found for tenant ${tenantId}`);
    }

    const merged: SyncJobConfig = {
      ...config,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await piIntegrationApi.updateSyncJob(config.id, buildSyncJobPayload(merged));
    return merged;
  }

  async getAllActiveSyncJobs(): Promise<SyncJobConfig[]> {
    const apiJobs = await piIntegrationApi.listSyncJobs();
    return apiJobs.filter((j) => j.isActive).map(mapSyncJobDtoToConfig);
  }

  /** No-op — backend cron handles scheduled syncs */
  async initializeAutoSync(): Promise<void> {
    console.log('ℹ️ PI auto-sync runs on backend cron — no browser initialization needed');
  }

  async getSyncStatus(tenantId: string) {
    const config = await this.getSyncJobConfig(tenantId);
    return {
      isRunning: false,
      isEnabled: config?.enabled ?? false,
      lastRun: config?.lastRun,
      lastSuccess: config?.lastSuccess,
      lastError: config?.lastError,
      nextRun: config?.nextRun,
      totalSynced: config?.syncedEventCount ?? 0,
      errorCount: config?.errorCount ?? 0,
    };
  }

  async triggerManualSync(tenantId: string): Promise<SyncResult> {
    return this.runSync(tenantId);
  }
}

export const autoPIEventSyncService = AutoPIEventSyncService.getInstance();
