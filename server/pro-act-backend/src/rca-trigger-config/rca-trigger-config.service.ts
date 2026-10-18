import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  RCATriggerConfig,
  RCATriggerGlobalSettings,
  RCATriggerRuleModel,
} from './rca-trigger-config.entity';
import { CreateRCATriggerConfigDto } from './dto/create-rca-trigger-config.dto';
import { UpdateRCATriggerConfigDto } from './dto/update-rca-trigger-config.dto';

const DEFAULT_GLOBAL_SETTINGS: RCATriggerGlobalSettings = {
  alwaysAllowManualCreation: true,
  showWarningForLowImpact: true,
  requireApprovalForLowImpact: false,
};

@Injectable()
export class RCATriggerConfigService {
  constructor(
    @InjectRepository(RCATriggerConfig)
    private readonly rcaTriggerConfigRepository: Repository<RCATriggerConfig>,
  ) {}

  private mergeGlobalSettings(
    settings?: RCATriggerGlobalSettings | null,
  ): RCATriggerGlobalSettings {
    return {
      alwaysAllowManualCreation:
        settings?.alwaysAllowManualCreation ??
        DEFAULT_GLOBAL_SETTINGS.alwaysAllowManualCreation,
      showWarningForLowImpact:
        settings?.showWarningForLowImpact ??
        DEFAULT_GLOBAL_SETTINGS.showWarningForLowImpact,
      requireApprovalForLowImpact:
        settings?.requireApprovalForLowImpact ??
        DEFAULT_GLOBAL_SETTINGS.requireApprovalForLowImpact,
      minCostThresholdGlobal: settings?.minCostThresholdGlobal ?? undefined,
      minDurationThresholdGlobal:
        settings?.minDurationThresholdGlobal ?? undefined,
    };
  }

  private normaliseRulesForPersist(
    incomingRules: RCATriggerRuleModel[] | undefined,
    tenantId?: string,
    organizationId?: string,
    existingRules?: RCATriggerRuleModel[],
  ): RCATriggerRuleModel[] {
    const existingRuleMap = new Map<string, RCATriggerRuleModel>();
    existingRules?.forEach((rule) => {
      existingRuleMap.set(rule.id, rule);
    });

    if (!incomingRules) {
      return existingRules ?? [];
    }

    const now = new Date().toISOString();

    return incomingRules.map((rule) => {
      const existing = rule.id ? existingRuleMap.get(rule.id) : undefined;
      const id = rule.id ?? existing?.id ?? randomUUID();
      const createdAt = existing?.createdAt ?? rule.createdAt ?? now;
      return {
        ...existing,
        ...rule,
        id,
        tenantId: rule.tenantId ?? existing?.tenantId ?? tenantId,
        organizationId:
          rule.organizationId ?? existing?.organizationId ?? organizationId,
        createdAt,
        updatedAt: now,
        enabled: rule.enabled ?? existing?.enabled ?? true,
        priority: rule.priority ?? existing?.priority ?? 50,
        conditions: {
          ...(existing?.conditions ?? {}),
          ...(rule.conditions ?? {}),
        },
      };
    });
  }

  private hydrateConfig(config: RCATriggerConfig): RCATriggerConfig {
    config.rules = Array.isArray(config.rules) ? config.rules : [];
    config.globalSettings = this.mergeGlobalSettings(config.globalSettings);
    return config;
  }

  async create(
    createDto: CreateRCATriggerConfigDto,
  ): Promise<RCATriggerConfig> {
    const rules = this.normaliseRulesForPersist(
      createDto.rules as unknown as RCATriggerRuleModel[] | undefined,
      createDto.tenantId,
      createDto.organizationId,
    );

    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const payload = this.rcaTriggerConfigRepository.create({
      id,
      ...createDto,
      rules,
      globalSettings: this.mergeGlobalSettings(createDto.globalSettings as any),
      isActive: createDto.isActive ?? true,
      autoCreateRca: createDto.autoCreateRca ?? false,
      legacyConditions: createDto.legacyConditions ?? undefined,
    });

    const saved = await this.rcaTriggerConfigRepository.save(payload);
    return this.hydrateConfig(saved);
  }

  async findAll(filters?: {
    tenantId?: string;
    organizationId?: string;
    isActive?: boolean;
  }): Promise<RCATriggerConfig[]> {
    const where: FindOptionsWhere<RCATriggerConfig> = {};
    if (filters?.tenantId) {
      where.tenantId = filters.tenantId;
    }
    if (filters?.organizationId) {
      where.organizationId = filters.organizationId;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const configs = await this.rcaTriggerConfigRepository.find({ where });
    return configs.map((config) => this.hydrateConfig(config));
  }

  async findOne(id: string): Promise<RCATriggerConfig> {
    const config = await this.rcaTriggerConfigRepository.findOne({
      where: { id },
    });
    if (!config) {
      throw new NotFoundException(
        `RCA trigger configuration with ID ${id} not found`,
      );
    }
    return this.hydrateConfig(config);
  }

  async update(
    id: string,
    updateDto: UpdateRCATriggerConfigDto,
  ): Promise<RCATriggerConfig> {
    const config = await this.findOne(id);

    if (updateDto.rules) {
      config.rules = this.normaliseRulesForPersist(
        updateDto.rules as unknown as RCATriggerRuleModel[],
        updateDto.tenantId ?? config.tenantId,
        updateDto.organizationId ?? config.organizationId,
        config.rules,
      );
    }

    if (updateDto.globalSettings) {
      config.globalSettings = this.mergeGlobalSettings(
        updateDto.globalSettings as any,
      );
    }

    if (updateDto.legacyConditions !== undefined) {
      config.legacyConditions = updateDto.legacyConditions;
    }

    if (updateDto.triggerType !== undefined) {
      config.triggerType = updateDto.triggerType;
    }

    if (updateDto.isActive !== undefined) {
      config.isActive = updateDto.isActive;
    }

    if (updateDto.autoCreateRca !== undefined) {
      config.autoCreateRca = updateDto.autoCreateRca;
    }

    if (updateDto.name !== undefined) {
      config.name = updateDto.name;
    }

    if (updateDto.description !== undefined) {
      config.description = updateDto.description;
    }

    if (updateDto.tenantId !== undefined) {
      config.tenantId = updateDto.tenantId;
    }

    if (updateDto.organizationId !== undefined) {
      config.organizationId = updateDto.organizationId;
    }

    const saved = await this.rcaTriggerConfigRepository.save(config);
    return this.hydrateConfig(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.rcaTriggerConfigRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(
        `RCA trigger configuration with ID ${id} not found`,
      );
    }
  }

  async getActiveConfig(tenantId: string): Promise<RCATriggerConfig | null> {
    const configs = await this.findAll({ tenantId, isActive: true });
    return configs[0] ?? null;
  }
}
