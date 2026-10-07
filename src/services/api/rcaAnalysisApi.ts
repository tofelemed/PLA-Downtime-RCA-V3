import { httpClient } from './httpClient';

export interface RCAAnalysisConfigDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  name: string;
  description?: string;
  isActive: boolean;
  enabledTools?: Record<string, boolean>;
  fiveWhyConfig?: Record<string, any>;
  fishboneConfig?: Record<string, any>;
  fmeaConfig?: Record<string, any>;
  faultTreeConfig?: Record<string, any>;
  knowledgeBaseConfig?: Record<string, any>;
  requiredFields?: Record<string, any>;
  legacyConfigData?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRCAAnalysisConfigPayload {
  tenantId?: string;
  organizationId?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  enabledTools?: Record<string, boolean>;
  fiveWhyConfig?: Record<string, any>;
  fishboneConfig?: Record<string, any>;
  fmeaConfig?: Record<string, any>;
  faultTreeConfig?: Record<string, any>;
  knowledgeBaseConfig?: Record<string, any>;
  requiredFields?: Record<string, any>;
}

export type UpdateRCAAnalysisConfigPayload = Partial<CreateRCAAnalysisConfigPayload>;

export interface FiveWhyAnalysisDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  rcaId: string;
  problem: string;
  whyLevels: {
    level: number;
    question: string;
    answer: string;
    justification?: string;
    evidence?: string[];
  }[];
  rootCause: string;
  verifiedBy?: string;
  verifiedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FishboneDiagramDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  rcaId: string;
  effect: string;
  categories: any[];
  createdAt: string;
  updatedAt: string;
}

export interface FmeaAnalysisDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  rcaId: string;
  failureMode: string;
  effects: any[];
  causes: any[];
  createdAt: string;
  updatedAt: string;
}

export interface FaultTreeAnalysisDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  rcaId: string;
  topEvent: string;
  nodes: any[];
  minimumCutSets?: string[][];
  createdAt: string;
  updatedAt: string;
}

export interface BarrierAnalysisDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  rcaId: string;
  hazard: string;
  barriers: any[];
  createdAt: string;
  updatedAt: string;
}

export interface ChangeAnalysisDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  rcaId: string;
  question: string;
  changes: any[];
  createdAt: string;
  updatedAt: string;
}

export const rcaAnalysisApi = {
  // Configs
  getConfigs(params?: { tenantId?: string; organizationId?: string; isActive?: boolean }) {
    return httpClient.request<RCAAnalysisConfigDto[]>('rca-analysis-configs', {
      method: 'GET',
      query: params,
    });
  },

  createConfig(payload: CreateRCAAnalysisConfigPayload) {
    return httpClient.request<RCAAnalysisConfigDto>('rca-analysis-configs', {
      method: 'POST',
      body: payload,
    });
  },

  updateConfig(id: string, payload: UpdateRCAAnalysisConfigPayload) {
    return httpClient.request<RCAAnalysisConfigDto>(`rca-analysis-configs/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  deleteConfig(id: string) {
    return httpClient.request<void>(`rca-analysis-configs/${id}`, {
      method: 'DELETE',
    });
  },

  // Five Why
  createFiveWhy(payload: Omit<FiveWhyAnalysisDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return httpClient.request<FiveWhyAnalysisDto>('rca-analysis/five-why', {
      method: 'POST',
      body: payload,
    });
  },

  getFiveWhy(params: { tenantId?: string; rcaId: string }) {
    return httpClient.request<FiveWhyAnalysisDto | null>('rca-analysis/five-why', {
      method: 'GET',
      query: params,
    });
  },

  updateFiveWhy(id: string, payload: Partial<FiveWhyAnalysisDto>) {
    return httpClient.request<FiveWhyAnalysisDto>(`rca-analysis/five-why/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteFiveWhy(id: string) {
    return httpClient.request<void>(`rca-analysis/five-why/${id}`, {
      method: 'DELETE',
    });
  },

  // Fishbone
  createFishbone(payload: Omit<FishboneDiagramDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return httpClient.request<FishboneDiagramDto>('rca-analysis/fishbone', {
      method: 'POST',
      body: payload,
    });
  },

  getFishbone(params: { tenantId?: string; rcaId: string }) {
    return httpClient.request<FishboneDiagramDto | null>('rca-analysis/fishbone', {
      method: 'GET',
      query: params,
    });
  },

  updateFishbone(id: string, payload: Partial<FishboneDiagramDto>) {
    return httpClient.request<FishboneDiagramDto>(`rca-analysis/fishbone/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteFishbone(id: string) {
    return httpClient.request<void>(`rca-analysis/fishbone/${id}`, {
      method: 'DELETE',
    });
  },

  // FMEA
  createFmea(payload: Omit<FmeaAnalysisDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return httpClient.request<FmeaAnalysisDto>('rca-analysis/fmea', {
      method: 'POST',
      body: payload,
    });
  },

  getFmea(params: { tenantId?: string; rcaId: string }) {
    return httpClient.request<FmeaAnalysisDto | null>('rca-analysis/fmea', {
      method: 'GET',
      query: params,
    });
  },

  updateFmea(id: string, payload: Partial<FmeaAnalysisDto>) {
    return httpClient.request<FmeaAnalysisDto>(`rca-analysis/fmea/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteFmea(id: string) {
    return httpClient.request<void>(`rca-analysis/fmea/${id}`, {
      method: 'DELETE',
    });
  },

  // Fault Tree
  createFaultTree(payload: Omit<FaultTreeAnalysisDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return httpClient.request<FaultTreeAnalysisDto>('rca-analysis/fault-tree', {
      method: 'POST',
      body: payload,
    });
  },

  getFaultTree(params: { tenantId?: string; rcaId: string }) {
    return httpClient.request<FaultTreeAnalysisDto | null>('rca-analysis/fault-tree', {
      method: 'GET',
      query: params,
    });
  },

  updateFaultTree(id: string, payload: Partial<FaultTreeAnalysisDto>) {
    return httpClient.request<FaultTreeAnalysisDto>(`rca-analysis/fault-tree/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteFaultTree(id: string) {
    return httpClient.request<void>(`rca-analysis/fault-tree/${id}`, {
      method: 'DELETE',
    });
  },

  // Barrier
  createBarrier(payload: Omit<BarrierAnalysisDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return httpClient.request<BarrierAnalysisDto>('rca-analysis/barrier', {
      method: 'POST',
      body: payload,
    });
  },

  getBarrier(params: { tenantId?: string; rcaId: string }) {
    return httpClient.request<BarrierAnalysisDto | null>('rca-analysis/barrier', {
      method: 'GET',
      query: params,
    });
  },

  updateBarrier(id: string, payload: Partial<BarrierAnalysisDto>) {
    return httpClient.request<BarrierAnalysisDto>(`rca-analysis/barrier/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteBarrier(id: string) {
    return httpClient.request<void>(`rca-analysis/barrier/${id}`, {
      method: 'DELETE',
    });
  },

  // Change
  createChange(payload: Omit<ChangeAnalysisDto, 'id' | 'createdAt' | 'updatedAt'>) {
    return httpClient.request<ChangeAnalysisDto>('rca-analysis/change', {
      method: 'POST',
      body: payload,
    });
  },

  getChange(params: { tenantId?: string; rcaId: string }) {
    return httpClient.request<ChangeAnalysisDto | null>('rca-analysis/change', {
      method: 'GET',
      query: params,
    });
  },

  updateChange(id: string, payload: Partial<ChangeAnalysisDto>) {
    return httpClient.request<ChangeAnalysisDto>(`rca-analysis/change/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteChange(id: string) {
    return httpClient.request<void>(`rca-analysis/change/${id}`, {
      method: 'DELETE',
    });
  },
};


