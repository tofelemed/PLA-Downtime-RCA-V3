// RCA Analysis Configuration & Methodology Service
// Backend API integration for RCA analysis tools

import {
  RCAAnalysisConfig,
  FiveWhyAnalysis,
  FishboneDiagram,
  FMEAAnalysis,
  FaultTreeAnalysis,
  BarrierAnalysis,
  ChangeAnalysis,
  DEFAULT_ANALYSIS_CONFIGS,
} from '../types/RCAKnowledgeBase';
import {
  rcaAnalysisApi,
  RCAAnalysisConfigDto,
  FiveWhyAnalysisDto,
  FishboneDiagramDto,
  FmeaAnalysisDto,
  FaultTreeAnalysisDto,
  BarrierAnalysisDto,
  ChangeAnalysisDto,
} from './api/rcaAnalysisApi';

class RCAAnalysisConfigService {
  private static instance: RCAAnalysisConfigService;

  private constructor() {}

  static getInstance(): RCAAnalysisConfigService {
    if (!RCAAnalysisConfigService.instance) {
      RCAAnalysisConfigService.instance = new RCAAnalysisConfigService();
    }
    return RCAAnalysisConfigService.instance;
  }

  // =============================
  // Configuration Helpers
  // =============================
  private mapConfigFromDto(dto: RCAAnalysisConfigDto): RCAAnalysisConfig {
    const defaults = DEFAULT_ANALYSIS_CONFIGS.OilAndGas;
    const enabledTools = {
      ...defaults.enabledTools,
      ...(dto.enabledTools ?? {}),
    };
    const fiveWhyConfig = {
      ...defaults.fiveWhyConfig,
      ...(dto.fiveWhyConfig ?? {}),
    };
    const fishboneConfig = {
      ...defaults.fishboneConfig,
      ...(dto.fishboneConfig ?? {}),
    };
    const fmeaConfig = {
      ...defaults.fmeaConfig,
      ...(dto.fmeaConfig ?? {}),
    };
    const faultTreeConfig = {
      ...defaults.faultTreeConfig,
      ...(dto.faultTreeConfig ?? {}),
    };
    const knowledgeBaseConfig = {
      ...defaults.knowledgeBaseConfig,
      ...(dto.knowledgeBaseConfig ?? {}),
    };
    const requiredFields = {
      ...defaults.requiredFields,
      ...(dto.requiredFields ?? {}),
    };

    return {
      id: dto.id,
      name: dto.name ?? defaults.name,
      description: dto.description ?? defaults.description,
      enabledTools,
      fiveWhyConfig,
      fishboneConfig,
      fmeaConfig,
      faultTreeConfig,
      knowledgeBaseConfig,
      requiredFields,
      tenantId: dto.tenantId ?? '',
      organizationId: dto.organizationId ?? undefined,
      createdAt: new Date(dto.createdAt).toISOString(),
      updatedAt: new Date(dto.updatedAt).toISOString(),
      isActive: dto.isActive ?? true,
    };
  }

  private buildConfigPayload(config: Omit<RCAAnalysisConfig, 'id' | 'createdAt' | 'updatedAt'>) {
    return {
      tenantId: config.tenantId,
      organizationId: config.organizationId,
      name: config.name,
      description: config.description,
      isActive: config.isActive,
      enabledTools: config.enabledTools,
      fiveWhyConfig: config.fiveWhyConfig,
      fishboneConfig: config.fishboneConfig,
      fmeaConfig: config.fmeaConfig,
      faultTreeConfig: config.faultTreeConfig,
      knowledgeBaseConfig: config.knowledgeBaseConfig,
      requiredFields: config.requiredFields,
    };
  }

  // =============================
  // Config API
  // =============================

  async getActiveConfig(tenantId: string): Promise<RCAAnalysisConfig | null> {
    const configs = await rcaAnalysisApi.getConfigs({ tenantId, isActive: true });
    if (configs.length === 0) {
      return null;
    }
    return this.mapConfigFromDto(configs[0]);
  }

  async createConfig(config: Omit<RCAAnalysisConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<RCAAnalysisConfig> {
    const dto = await rcaAnalysisApi.createConfig(this.buildConfigPayload(config));
    return this.mapConfigFromDto(dto);
  }

  async updateConfig(id: string, updates: Partial<RCAAnalysisConfig>): Promise<RCAAnalysisConfig> {
    const dto = await rcaAnalysisApi.updateConfig(id, updates);
    return this.mapConfigFromDto(dto);
  }

  async initializeDefaultConfig(
    tenantId: string,
    organizationId: string,
    industryType: 'OilAndGas' | 'Cement' = 'OilAndGas',
  ): Promise<RCAAnalysisConfig> {
    const existing = await this.getActiveConfig(tenantId);
    if (existing) {
      return existing;
    }

    const template = DEFAULT_ANALYSIS_CONFIGS[industryType];
    return this.createConfig({
      name: template.name,
      description: template.description,
      enabledTools: template.enabledTools,
      fiveWhyConfig: template.fiveWhyConfig,
      fishboneConfig: template.fishboneConfig,
      fmeaConfig: template.fmeaConfig,
      faultTreeConfig: template.faultTreeConfig,
      knowledgeBaseConfig: template.knowledgeBaseConfig,
      requiredFields: template.requiredFields,
      tenantId,
      organizationId,
      isActive: true,
    });
  }

  // =============================
  // Methodology Mapping Helpers
  // =============================

  private mapFiveWhyFromDto(dto: FiveWhyAnalysisDto): FiveWhyAnalysis {
    return {
      id: dto.id,
      rcaId: dto.rcaId,
      problem: dto.problem,
      whyLevels: dto.whyLevels ?? [],
      rootCause: dto.rootCause,
      verifiedBy: dto.verifiedBy,
      verifiedDate: dto.verifiedDate ?? undefined,
      createdAt: new Date(dto.createdAt).toISOString(),
      updatedAt: new Date(dto.updatedAt).toISOString(),
    };
  }

  private mapFishboneFromDto(dto: FishboneDiagramDto): FishboneDiagram {
    return {
      id: dto.id,
      rcaId: dto.rcaId,
      effect: dto.effect,
      categories: dto.categories ?? [],
      createdAt: new Date(dto.createdAt).toISOString(),
      updatedAt: new Date(dto.updatedAt).toISOString(),
    };
  }

  private mapFmeaFromDto(dto: FmeaAnalysisDto): FMEAAnalysis {
    return {
      id: dto.id,
      rcaId: dto.rcaId,
      failureMode: dto.failureMode,
      effects: dto.effects ?? [],
      causes: dto.causes ?? [],
      createdAt: new Date(dto.createdAt).toISOString(),
      updatedAt: new Date(dto.updatedAt).toISOString(),
    };
  }

  private mapFaultTreeFromDto(dto: FaultTreeAnalysisDto): FaultTreeAnalysis {
    return {
      id: dto.id,
      rcaId: dto.rcaId,
      topEvent: dto.topEvent,
      nodes: dto.nodes ?? [],
      minimumCutSets: dto.minimumCutSets ?? undefined,
      createdAt: new Date(dto.createdAt).toISOString(),
      updatedAt: new Date(dto.updatedAt).toISOString(),
    };
  }

  private mapBarrierFromDto(dto: BarrierAnalysisDto): BarrierAnalysis {
    return {
      id: dto.id,
      rcaId: dto.rcaId,
      hazard: dto.hazard,
      barriers: dto.barriers ?? [],
      createdAt: new Date(dto.createdAt).toISOString(),
      updatedAt: new Date(dto.updatedAt).toISOString(),
    };
  }

  private mapChangeFromDto(dto: ChangeAnalysisDto): ChangeAnalysis {
    return {
      id: dto.id,
      rcaId: dto.rcaId,
      question: dto.question,
      changes: dto.changes ?? [],
      createdAt: new Date(dto.createdAt).toISOString(),
      updatedAt: new Date(dto.updatedAt).toISOString(),
    };
  }

  // =============================
  // Five Why
  // =============================

  async createFiveWhyAnalysis(analysis: Omit<FiveWhyAnalysis, 'id' | 'createdAt' | 'updatedAt'>): Promise<FiveWhyAnalysis> {
    const dto = await rcaAnalysisApi.createFiveWhy(analysis);
    return this.mapFiveWhyFromDto(dto);
  }

  async getFiveWhyByRCAId(rcaId: string, tenantId?: string): Promise<FiveWhyAnalysis | null> {
    const dto = await rcaAnalysisApi.getFiveWhy({ tenantId, rcaId });
    return dto ? this.mapFiveWhyFromDto(dto) : null;
  }

  async updateFiveWhyAnalysis(id: string, updates: Partial<FiveWhyAnalysis>): Promise<FiveWhyAnalysis> {
    const dto = await rcaAnalysisApi.updateFiveWhy(id, updates);
    return this.mapFiveWhyFromDto(dto);
  }

  async saveFiveWhyAnalysis(
    analysis: Omit<FiveWhyAnalysis, 'id' | 'createdAt' | 'updatedAt'>,
    existing?: FiveWhyAnalysis | null,
  ): Promise<FiveWhyAnalysis> {
    if (existing?.id) {
      return this.updateFiveWhyAnalysis(existing.id, analysis);
    }
    return this.createFiveWhyAnalysis(analysis);
  }

  // =============================
  // Fishbone
  // =============================

  async createFishboneDiagram(diagram: Omit<FishboneDiagram, 'id' | 'createdAt' | 'updatedAt'>): Promise<FishboneDiagram> {
    const dto = await rcaAnalysisApi.createFishbone(diagram);
    return this.mapFishboneFromDto(dto);
  }

  async getFishboneByRCAId(rcaId: string, tenantId?: string): Promise<FishboneDiagram | null> {
    const dto = await rcaAnalysisApi.getFishbone({ tenantId, rcaId });
    return dto ? this.mapFishboneFromDto(dto) : null;
  }

  async updateFishboneDiagram(id: string, updates: Partial<FishboneDiagram>): Promise<FishboneDiagram> {
    const dto = await rcaAnalysisApi.updateFishbone(id, updates);
    return this.mapFishboneFromDto(dto);
  }

  async saveFishboneDiagram(
    diagram: Omit<FishboneDiagram, 'id' | 'createdAt' | 'updatedAt'>,
    existing?: FishboneDiagram | null,
  ): Promise<FishboneDiagram> {
    if (existing?.id) {
      return this.updateFishboneDiagram(existing.id, diagram);
    }
    return this.createFishboneDiagram(diagram);
  }

  // =============================
  // FMEA
  // =============================

  async createFMEAAnalysis(analysis: Omit<FMEAAnalysis, 'id' | 'createdAt' | 'updatedAt'>): Promise<FMEAAnalysis> {
    const dto = await rcaAnalysisApi.createFmea(analysis);
    return this.mapFmeaFromDto(dto);
  }

  async getFMEAByRCAId(rcaId: string, tenantId?: string): Promise<FMEAAnalysis | null> {
    const dto = await rcaAnalysisApi.getFmea({ tenantId, rcaId });
    return dto ? this.mapFmeaFromDto(dto) : null;
  }

  async updateFMEAAnalysis(id: string, updates: Partial<FMEAAnalysis>): Promise<FMEAAnalysis> {
    const dto = await rcaAnalysisApi.updateFmea(id, updates);
    return this.mapFmeaFromDto(dto);
  }

  async saveFMEAAnalysis(
    analysis: Omit<FMEAAnalysis, 'id' | 'createdAt' | 'updatedAt'>,
    existing?: FMEAAnalysis | null,
  ): Promise<FMEAAnalysis> {
    if (existing?.id) {
      return this.updateFMEAAnalysis(existing.id, analysis);
    }
    return this.createFMEAAnalysis(analysis);
  }

  // =============================
  // Fault Tree
  // =============================

  async createFaultTreeAnalysis(analysis: Omit<FaultTreeAnalysis, 'id' | 'createdAt' | 'updatedAt'>): Promise<FaultTreeAnalysis> {
    const dto = await rcaAnalysisApi.createFaultTree(analysis);
    return this.mapFaultTreeFromDto(dto);
  }

  async getFaultTreeByRCAId(rcaId: string, tenantId?: string): Promise<FaultTreeAnalysis | null> {
    const dto = await rcaAnalysisApi.getFaultTree({ tenantId, rcaId });
    return dto ? this.mapFaultTreeFromDto(dto) : null;
  }

  async updateFaultTreeAnalysis(id: string, updates: Partial<FaultTreeAnalysis>): Promise<FaultTreeAnalysis> {
    const dto = await rcaAnalysisApi.updateFaultTree(id, updates);
    return this.mapFaultTreeFromDto(dto);
  }

  async saveFaultTreeAnalysis(
    analysis: Omit<FaultTreeAnalysis, 'id' | 'createdAt' | 'updatedAt'>,
    existing?: FaultTreeAnalysis | null,
  ): Promise<FaultTreeAnalysis> {
    if (existing?.id) {
      return this.updateFaultTreeAnalysis(existing.id, analysis);
    }
    return this.createFaultTreeAnalysis(analysis);
  }

  // =============================
  // Barrier
  // =============================

  async createBarrierAnalysis(analysis: Omit<BarrierAnalysis, 'id' | 'createdAt' | 'updatedAt'>): Promise<BarrierAnalysis> {
    const dto = await rcaAnalysisApi.createBarrier(analysis);
    return this.mapBarrierFromDto(dto);
  }

  async getBarrierByRCAId(rcaId: string, tenantId?: string): Promise<BarrierAnalysis | null> {
    const dto = await rcaAnalysisApi.getBarrier({ tenantId, rcaId });
    return dto ? this.mapBarrierFromDto(dto) : null;
  }

  async updateBarrierAnalysis(id: string, updates: Partial<BarrierAnalysis>): Promise<BarrierAnalysis> {
    const dto = await rcaAnalysisApi.updateBarrier(id, updates);
    return this.mapBarrierFromDto(dto);
  }

  async saveBarrierAnalysis(
    analysis: Omit<BarrierAnalysis, 'id' | 'createdAt' | 'updatedAt'>,
    existing?: BarrierAnalysis | null,
  ): Promise<BarrierAnalysis> {
    if (existing?.id) {
      return this.updateBarrierAnalysis(existing.id, analysis);
    }
    return this.createBarrierAnalysis(analysis);
  }

  // =============================
  // Change
  // =============================

  async createChangeAnalysis(analysis: Omit<ChangeAnalysis, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChangeAnalysis> {
    const dto = await rcaAnalysisApi.createChange(analysis);
    return this.mapChangeFromDto(dto);
  }

  async getChangeByRCAId(rcaId: string, tenantId?: string): Promise<ChangeAnalysis | null> {
    const dto = await rcaAnalysisApi.getChange({ tenantId, rcaId });
    return dto ? this.mapChangeFromDto(dto) : null;
  }

  async updateChangeAnalysis(id: string, updates: Partial<ChangeAnalysis>): Promise<ChangeAnalysis> {
    const dto = await rcaAnalysisApi.updateChange(id, updates);
    return this.mapChangeFromDto(dto);
  }

  async saveChangeAnalysis(
    analysis: Omit<ChangeAnalysis, 'id' | 'createdAt' | 'updatedAt'>,
    existing?: ChangeAnalysis | null,
  ): Promise<ChangeAnalysis> {
    if (existing?.id) {
      return this.updateChangeAnalysis(existing.id, analysis);
    }
    return this.createChangeAnalysis(analysis);
  }
}

export const rcaAnalysisConfigService = RCAAnalysisConfigService.getInstance();

