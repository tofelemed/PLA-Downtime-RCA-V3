import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { RCAAnalysisConfig } from './rca-analysis-config.entity';
import { CreateRCAAnalysisConfigDto } from './dto/create-rca-analysis-config.dto';
import { UpdateRCAAnalysisConfigDto } from './dto/update-rca-analysis-config.dto';

@Injectable()
export class RCAAnalysisConfigService {
  constructor(
    @InjectRepository(RCAAnalysisConfig)
    private readonly rcaAnalysisConfigRepository: Repository<RCAAnalysisConfig>,
  ) {}

  async create(createDto: CreateRCAAnalysisConfigDto): Promise<RCAAnalysisConfig> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const snapshot = this.serializeSnapshot(createDto);
    const config = this.rcaAnalysisConfigRepository.create({
      id,
      ...createDto,
      legacyConfigData: snapshot,
    });
    const saved = await this.rcaAnalysisConfigRepository.save(config);
    return this.hydrateConfig(saved);
  }

  async findAll(filters?: {
    tenantId?: string;
    organizationId?: string;
    isActive?: boolean;
  }): Promise<RCAAnalysisConfig[]> {
    const where: Record<string, unknown> = {};
    if (filters?.tenantId) {
      where.tenantId = filters.tenantId;
    }
    if (filters?.organizationId) {
      where.organizationId = filters.organizationId;
    }
    if (filters?.isActive !== undefined) {
      // isActive property is mapped to is_default column in entity
      where.isActive = filters.isActive;
    }
    const configs = await this.rcaAnalysisConfigRepository.find({ where });
    return configs.map((cfg) => this.hydrateConfig(cfg));
  }

  async findOne(id: string): Promise<RCAAnalysisConfig> {
    const config = await this.rcaAnalysisConfigRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`RCA analysis configuration with ID ${id} not found`);
    }
    return this.hydrateConfig(config);
  }

  async update(id: string, updateDto: UpdateRCAAnalysisConfigDto): Promise<RCAAnalysisConfig> {
    const config = await this.findOne(id);
    const snapshot = this.serializeSnapshot({
      ...config,
      ...updateDto,
    });
    Object.assign(config, {
      ...updateDto,
      legacyConfigData: snapshot,
    });
    const saved = await this.rcaAnalysisConfigRepository.save(config);
    return this.hydrateConfig(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.rcaAnalysisConfigRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`RCA analysis configuration with ID ${id} not found`);
    }
  }

  private hydrateConfig(config: RCAAnalysisConfig): RCAAnalysisConfig {
    // Note: enabledTools, fiveWhyConfig, etc. don't exist as separate columns
    // They should be stored in config_data JSON column
    // The entity structure doesn't match the database schema
    // Database has: analysis_type, config_name, config_data, is_default
    if (config.legacyConfigData) {
      try {
        const legacy = JSON.parse(config.legacyConfigData);
        // Note: These properties don't exist in the entity
        // config.enabledTools ??= legacy.enabledTools;
        // config.fiveWhyConfig ??= legacy.fiveWhyConfig;
        // config.fishboneConfig ??= legacy.fishboneConfig;
        // config.fmeaConfig ??= legacy.fmeaConfig;
        // config.faultTreeConfig ??= legacy.faultTreeConfig;
        // config.knowledgeBaseConfig ??= legacy.knowledgeBaseConfig;
        // Note: requiredFields doesn't exist in database schema
        // config.requiredFields ??= legacy.requiredFields;
        config.name ??= legacy.name ?? legacy.configName;
        // Note: description doesn't exist in entity
        // config.description ??= legacy.description;
        if (config.isActive === undefined && legacy.isActive !== undefined) {
          config.isActive = legacy.isActive;
        }
      } catch (error) {
        // ignore parsing failure
      }
    }
    return config;
  }

  private serializeSnapshot(payload: Partial<RCAAnalysisConfig> | CreateRCAAnalysisConfigDto): string | undefined {
    try {
      const snapshot = {
        name: (payload as any).name,
        description: (payload as any).description,
        enabledTools: (payload as any).enabledTools,
        fiveWhyConfig: (payload as any).fiveWhyConfig,
        fishboneConfig: (payload as any).fishboneConfig,
        fmeaConfig: (payload as any).fmeaConfig,
        faultTreeConfig: (payload as any).faultTreeConfig,
        knowledgeBaseConfig: (payload as any).knowledgeBaseConfig,
        // Note: requiredFields doesn't exist in database schema
        // requiredFields: (payload as any).requiredFields,
        isActive: (payload as any).isActive,
      };
      return JSON.stringify(snapshot);
    } catch {
      return undefined;
    }
  }
}

