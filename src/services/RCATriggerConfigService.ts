// RCA Trigger Configuration Service
// Talks to backend API with IndexedDB fallback

import {
  RCATriggerConfig,
  RCATriggerRule,
  DEFAULT_RCA_TRIGGER_CONFIGS,
  shouldTriggerRCA,
} from '../types/RCATriggerConfig';
import {
  rcaTriggerConfigApi,
  RCATriggerConfigDto,
  RCATriggerGlobalSettingsDto,
  RCATriggerRuleDto,
} from './api/rcaTriggerConfigApi';

const DEFAULT_GLOBAL_SETTINGS = DEFAULT_RCA_TRIGGER_CONFIGS.OilAndGas.globalSettings;

const generateId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sanitizePayload = <T extends Record<string, unknown>>(payload: T): T => {
  const cleaned: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    cleaned[key] = value;
  });
  return cleaned as T;
};

class RCATriggerConfigService {
  private static instance: RCATriggerConfigService;

  private constructor() {}

  static getInstance(): RCATriggerConfigService {
    if (!RCATriggerConfigService.instance) {
      RCATriggerConfigService.instance = new RCATriggerConfigService();
    }
    return RCATriggerConfigService.instance;
  }

  private mergeGlobalSettings(
    settings?: RCATriggerConfig['globalSettings'] | RCATriggerGlobalSettingsDto | null,
  ): RCATriggerConfig['globalSettings'] {
    return {
      alwaysAllowManualCreation:
        settings?.alwaysAllowManualCreation ?? DEFAULT_GLOBAL_SETTINGS.alwaysAllowManualCreation,
      showWarningForLowImpact:
        settings?.showWarningForLowImpact ?? DEFAULT_GLOBAL_SETTINGS.showWarningForLowImpact,
      requireApprovalForLowImpact:
        settings?.requireApprovalForLowImpact ?? DEFAULT_GLOBAL_SETTINGS.requireApprovalForLowImpact,
      minCostThresholdGlobal:
        settings?.minCostThresholdGlobal ?? DEFAULT_GLOBAL_SETTINGS.minCostThresholdGlobal,
      minDurationThresholdGlobal:
        settings?.minDurationThresholdGlobal ?? DEFAULT_GLOBAL_SETTINGS.minDurationThresholdGlobal,
    };
  }

  private normaliseRulesForSave(
    rules: RCATriggerRule[] | undefined,
    context: { tenantId?: string; organizationId?: string },
  ): RCATriggerRule[] {
    if (!rules) {
      return [];
    }
    const now = new Date().toISOString();
    return rules.map((rule) => ({
      ...rule,
      id: rule.id ?? generateId('rca-trigger-rule'),
      createdAt: rule.createdAt ?? now,
      updatedAt: now,
      tenantId: rule.tenantId ?? context.tenantId ?? '',
      organizationId: rule.organizationId ?? context.organizationId,
      enabled: rule.enabled ?? true,
      priority: rule.priority ?? 50,
      conditions: rule.conditions ?? {},
    }));
  }

  private mapRuleDtoToModel(
    dto: RCATriggerRuleDto,
    context: { tenantId?: string; organizationId?: string; fallbackTimestamp: string },
  ): RCATriggerRule {
    return {
      id: dto.id ?? generateId('rca-trigger-rule'),
      name: dto.name,
      description: dto.description ?? '',
      eventType: dto.eventType,
      enabled: dto.enabled ?? true,
      conditions: dto.conditions ?? {},
      priority: dto.priority ?? 50,
      createdAt: dto.createdAt ?? context.fallbackTimestamp,
      updatedAt: dto.updatedAt ?? context.fallbackTimestamp,
      tenantId: dto.tenantId ?? context.tenantId ?? '',
      organizationId: dto.organizationId ?? context.organizationId,
    };
  }

  private mapDtoToConfig(dto: RCATriggerConfigDto): RCATriggerConfig {
    const fallbackTimestamp = dto.updatedAt ?? dto.createdAt ?? new Date().toISOString();
    const rules = (dto.rules ?? []).map((rule) =>
      this.mapRuleDtoToModel(rule, {
        tenantId: dto.tenantId,
        organizationId: dto.organizationId,
        fallbackTimestamp,
      }),
    );

    return {
      id: dto.id,
      name: dto.name,
      description: dto.description ?? '',
      rules,
      globalSettings: this.mergeGlobalSettings(dto.globalSettings),
      tenantId: dto.tenantId ?? '',
      organizationId: dto.organizationId,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      isActive: dto.isActive,
      autoCreateRca: dto.autoCreateRca ?? false,
    };
  }

  private toRuleDto(rule: RCATriggerRule): RCATriggerRuleDto {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      eventType: rule.eventType,
      enabled: rule.enabled,
      conditions: rule.conditions,
      priority: rule.priority,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      tenantId: rule.tenantId,
      organizationId: rule.organizationId,
    };
  }

  private buildPayloadFromConfig(config: RCATriggerConfig) {
    return sanitizePayload({
      tenantId: config.tenantId,
      organizationId: config.organizationId,
      name: config.name,
      description: config.description,
      isActive: config.isActive,
      autoCreateRca: config.autoCreateRca ?? false,
      triggerType: undefined,
      legacyConditions: undefined,
      globalSettings: this.mergeGlobalSettings(config.globalSettings),
      rules: config.rules?.map((rule) => this.toRuleDto(rule)),
    });
  }

  private async getConfigFromApi(id: string): Promise<RCATriggerConfig | null> {
    const dto = await rcaTriggerConfigApi.getConfig(id);
    return this.mapDtoToConfig(dto);
  }

  async getActiveConfig(tenantId: string): Promise<RCATriggerConfig | null> {
    const configs = await rcaTriggerConfigApi.getConfigs({ tenantId, isActive: true });
    if (configs.length === 0) {
      return null;
    }
    return this.mapDtoToConfig(configs[0]);
  }

  async getAllConfigs(tenantId: string): Promise<RCATriggerConfig[]> {
    const configs = await rcaTriggerConfigApi.getConfigs({ tenantId });
    return configs.map((dto) => this.mapDtoToConfig(dto));
  }

  async createConfig(
    config: Omit<RCATriggerConfig, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<RCATriggerConfig> {
    const preparedRules = this.normaliseRulesForSave(config.rules, {
      tenantId: config.tenantId,
      organizationId: config.organizationId,
    });
    const payload = this.buildPayloadFromConfig({
      ...config,
      rules: preparedRules,
      createdAt: '',
      updatedAt: '',
      id: '',
    } as RCATriggerConfig);

    const dto = await rcaTriggerConfigApi.createConfig(payload);
    return this.mapDtoToConfig(dto);
  }

  async updateConfig(id: string, updates: Partial<RCATriggerConfig>): Promise<RCATriggerConfig> {
    const existing = await this.getConfigFromApi(id);
    if (!existing) {
      throw new Error(`RCA trigger config ${id} not found`);
    }

    const tenantId = updates.tenantId ?? existing.tenantId;
    const organizationId = updates.organizationId ?? existing.organizationId;

    const mergedRules = updates.rules
      ? this.normaliseRulesForSave(updates.rules, { tenantId, organizationId })
      : existing.rules;

    const mergedGlobalSettings = updates.globalSettings
      ? this.mergeGlobalSettings(updates.globalSettings)
      : existing.globalSettings;

    const mergedConfig: RCATriggerConfig = {
      ...existing,
      ...updates,
      id,
      tenantId,
      organizationId,
      rules: mergedRules,
      globalSettings: mergedGlobalSettings,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const payload = this.buildPayloadFromConfig(mergedConfig);
    const dto = await rcaTriggerConfigApi.updateConfig(id, payload);
    return this.mapDtoToConfig(dto);
  }

  async deleteConfig(id: string): Promise<void> {
    await rcaTriggerConfigApi.deleteConfig(id);
  }

  async activateConfig(id: string, tenantId: string): Promise<void> {
    const configs = await rcaTriggerConfigApi.getConfigs({ tenantId });
    await Promise.all(
      configs.map((config) =>
        config.id === id
          ? rcaTriggerConfigApi.updateConfig(config.id, { isActive: true })
          : config.isActive
            ? rcaTriggerConfigApi.updateConfig(config.id, { isActive: false })
            : Promise.resolve(),
      ),
    );
  }

  async initializeDefaultConfig(
    tenantId: string,
    organizationId: string,
    industryType: 'OilAndGas' | 'Cement' = 'OilAndGas',
  ): Promise<RCATriggerConfig> {
    const existing = await this.getActiveConfig(tenantId);
    if (existing) {
      return existing;
    }

    const template = DEFAULT_RCA_TRIGGER_CONFIGS[industryType];
    const now = new Date().toISOString();
    const rules: RCATriggerRule[] = template.rules.map((rule) => ({
        ...rule,
      id: rule.id ?? generateId('rca-trigger-rule'),
      createdAt: now,
      updatedAt: now,
        tenantId,
        organizationId,
      enabled: rule.enabled ?? true,
      priority: rule.priority ?? 50,
      conditions: rule.conditions ?? {},
    }));

    return this.createConfig({
      name: template.name,
      description: template.description,
      rules,
      globalSettings: template.globalSettings,
      tenantId,
      organizationId,
      isActive: true,
    });
  }

  async shouldShowRCAButton(
    event: any,
    tenantId: string,
  ): Promise<{ shouldShow: boolean; reason: string; warning?: string }> {
    const config = await this.getActiveConfig(tenantId);
    return shouldTriggerRCA(event, config);
  }

  async addRule(
    configId: string,
    rule: Omit<RCATriggerRule, 'createdAt' | 'updatedAt'>,
  ): Promise<RCATriggerConfig> {
    const existing = await this.getConfigFromApi(configId);
    if (!existing) {
      throw new Error(`RCA trigger config ${configId} not found`);
    }

    const now = new Date().toISOString();
    const newRule: RCATriggerRule = {
      ...rule,
      id: rule.id ?? generateId('rca-trigger-rule'),
      createdAt: now,
      updatedAt: now,
      tenantId: rule.tenantId ?? existing.tenantId,
      organizationId: rule.organizationId ?? existing.organizationId,
      enabled: rule.enabled ?? true,
      priority: rule.priority ?? 50,
      conditions: rule.conditions ?? {},
    };

    return this.updateConfig(configId, {
      rules: [...existing.rules, newRule],
    });
  }

  async updateRule(
    configId: string,
    ruleId: string,
    updates: Partial<RCATriggerRule>,
  ): Promise<RCATriggerConfig> {
    const existing = await this.getConfigFromApi(configId);
    if (!existing) {
      throw new Error(`RCA trigger config ${configId} not found`);
    }

    const now = new Date().toISOString();
    const updatedRules = existing.rules.map((rule) =>
      rule.id === ruleId
        ? {
            ...rule,
            ...updates,
            updatedAt: now,
            conditions: {
              ...rule.conditions,
              ...(updates.conditions ?? {}),
            },
          }
        : rule,
    );

    return this.updateConfig(configId, { rules: updatedRules });
  }

  async deleteRule(configId: string, ruleId: string): Promise<RCATriggerConfig> {
    const existing = await this.getConfigFromApi(configId);
    if (!existing) {
      throw new Error(`RCA trigger config ${configId} not found`);
    }

    const updatedRules = existing.rules.filter((rule) => rule.id !== ruleId);
    return this.updateConfig(configId, { rules: updatedRules });
  }

  async toggleRule(configId: string, ruleId: string): Promise<RCATriggerConfig> {
    const existing = await this.getConfigFromApi(configId);
    if (!existing) {
      throw new Error(`RCA trigger config ${configId} not found`);
    }

    const now = new Date().toISOString();
    const updatedRules = existing.rules.map((rule) =>
      rule.id === ruleId
        ? { ...rule, enabled: !rule.enabled, updatedAt: now }
        : rule,
    );
    return this.updateConfig(configId, { rules: updatedRules });
  }
}

export const rcaTriggerConfigService = RCATriggerConfigService.getInstance();

