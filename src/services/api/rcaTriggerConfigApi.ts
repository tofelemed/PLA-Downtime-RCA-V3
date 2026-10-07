import { httpClient } from './httpClient';

export type RCATriggerEventType =
  | 'ProductionLoss'
  | 'IOW'
  | 'SOL'
  | 'APM'
  | 'FailureWO'
  | 'ProductionOutput'
  | 'All';

export type RCATriggerSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type RCATriggerStatus = 'Open' | 'In Progress' | 'Closed' | 'Cancelled';
export type RCATriggerQualityResult = 'Pass' | 'Fail';
export type RCATriggerAPMType = 'Health' | 'Prediction' | 'Alert';
export type RCATriggerSOLType = 'Safety' | 'Operational';

export interface RCATriggerRuleConditionsDto {
  severities?: RCATriggerSeverity[];
  minCost?: number;
  minDuration?: number;
  statuses?: RCATriggerStatus[];
  impactCategories?: string[];
  oeeCategories?: string[];
  requiresImpactCode?: boolean;
  requiresOEECode?: boolean;
  qualityResults?: RCATriggerQualityResult[];
  apmTypes?: RCATriggerAPMType[];
  solTypes?: RCATriggerSOLType[];
}

export interface RCATriggerRuleDto {
  id?: string;
  name: string;
  description?: string;
  eventType: RCATriggerEventType;
  enabled?: boolean;
  conditions: RCATriggerRuleConditionsDto;
  priority?: number;
  createdAt?: string;
  updatedAt?: string;
  tenantId?: string;
  organizationId?: string;
}

export interface RCATriggerGlobalSettingsDto {
  alwaysAllowManualCreation?: boolean;
  showWarningForLowImpact?: boolean;
  requireApprovalForLowImpact?: boolean;
  minCostThresholdGlobal?: number;
  minDurationThresholdGlobal?: number;
}

export interface RCATriggerConfigDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  name: string;
  description?: string;
  rules?: RCATriggerRuleDto[];
  globalSettings?: RCATriggerGlobalSettingsDto;
  isActive: boolean;
  autoCreateRca: boolean;
  triggerType?: string;
  legacyConditions?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRCATriggerConfigPayload {
  tenantId?: string;
  organizationId?: string;
  name: string;
  description?: string;
  rules?: RCATriggerRuleDto[];
  globalSettings?: RCATriggerGlobalSettingsDto;
  isActive?: boolean;
  autoCreateRca?: boolean;
  triggerType?: string;
  legacyConditions?: string;
}

export type UpdateRCATriggerConfigPayload = Partial<CreateRCATriggerConfigPayload>;

export const rcaTriggerConfigApi = {
  getConfigs(params?: { tenantId?: string; organizationId?: string; isActive?: boolean }) {
    return httpClient.request<RCATriggerConfigDto[]>('rca-trigger-configs', {
      method: 'GET',
      query: params,
    });
  },

  getConfig(id: string) {
    return httpClient.request<RCATriggerConfigDto>(`rca-trigger-configs/${id}`, {
      method: 'GET',
    });
  },

  createConfig(payload: CreateRCATriggerConfigPayload) {
    return httpClient.request<RCATriggerConfigDto>('rca-trigger-configs', {
      method: 'POST',
      body: payload,
    });
  },

  updateConfig(id: string, payload: UpdateRCATriggerConfigPayload) {
    return httpClient.request<RCATriggerConfigDto>(`rca-trigger-configs/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  deleteConfig(id: string) {
    return httpClient.request<void>(`rca-trigger-configs/${id}`, {
      method: 'DELETE',
    });
  },
};


