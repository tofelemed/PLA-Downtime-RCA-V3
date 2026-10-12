import { httpClient } from './httpClient';

export interface Organization {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  code: string;
  description?: string;
  organizationId: string;
  isActive: boolean;
  address?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  timezone?: string;
  calendarSystem?: 'gregorian' | 'persian';
  digits?: 'latin' | 'persian';
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  name: string;
  code: string;
  description?: string;
  capacity?: number;
  unitOfMeasure?: string;
  /** Seconds per unit, for OEE performance. */
  idealCycleTime?: number;
  tenantId: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  unitId: string;
  tenantId: string;
  description?: string;
  assetType: string;
  criticality: string;
  status: string;
  location?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installationDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImpactCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: 'Quality' | 'Availability' | 'Performance';
  costPerUnit?: number;
  costPerHour?: number;
  costBasis?: 'perUnit' | 'perHour';
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OEECode {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: 'Planned' | 'Unplanned';
  impactType: 'Availability' | 'Performance' | 'Quality';
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RCACauseCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: 'Equipment' | 'Process' | 'Material' | 'Personnel' | 'Environment' | 'Method';
  parentId?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  unitOfMeasure: string;
  standardCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReasonCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationStatusCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  color: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceCategory {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceLocation {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RCATemplateDto {
  id: string;
  name: string;
  description?: string;
  category: string;
  logicTreeStructure: any;
  verificationChecklist: string[];
  organizationId: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export const masterDataApi = {
  getOrganizations() {
    return httpClient.request<Organization[]>('organizations', { method: 'GET' });
  },

  getOrganization(id: string) {
    return httpClient.request<Organization>(`organizations/${id}`, { method: 'GET' });
  },

  createOrganization(payload: Partial<Organization>) {
    return httpClient.request<Organization>('organizations', {
      method: 'POST',
      body: payload,
    });
  },

  updateOrganization(id: string, payload: Partial<Organization>) {
    return httpClient.request<Organization>(`organizations/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteOrganization(id: string) {
    return httpClient.request<void>(`organizations/${id}`, {
      method: 'DELETE',
    });
  },

  getTenants(params?: { organizationId?: string }) {
    return httpClient.request<Tenant[]>('tenants', {
      method: 'GET',
      query: params,
    });
  },

  getTenant(id: string) {
    return httpClient.request<Tenant>(`tenants/${id}`, { method: 'GET' });
  },

  createTenant(payload: Partial<Tenant>) {
    return httpClient.request<Tenant>('tenants', {
      method: 'POST',
      body: payload,
    });
  },

  updateTenant(id: string, payload: Partial<Tenant>) {
    return httpClient.request<Tenant>(`tenants/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  updateTenantDisplaySettings(
    tenantId: string,
    body: Pick<Tenant, 'calendarSystem' | 'digits'>,
  ): Promise<Tenant> {
    return httpClient.request<Tenant>(`tenants/${tenantId}/display-settings`, {
      method: 'PUT',
      body,
    });
  },

  deleteTenant(id: string) {
    return httpClient.request<void>(`tenants/${id}`, {
      method: 'DELETE',
    });
  },

  getUnits(params?: { tenantId?: string }) {
    return httpClient.request<Unit[]>('units', {
      method: 'GET',
      query: params,
    });
  },

  getUnit(id: string) {
    return httpClient.request<Unit>(`units/${id}`, { method: 'GET' });
  },

  createUnit(payload: Partial<Unit>) {
    return httpClient.request<Unit>('units', {
      method: 'POST',
      body: payload,
    });
  },

  updateUnit(id: string, payload: Partial<Unit>) {
    return httpClient.request<Unit>(`units/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteUnit(id: string) {
    return httpClient.request<void>(`units/${id}`, {
      method: 'DELETE',
    });
  },

  getAssets(params?: { tenantId?: string; unitId?: string }) {
    return httpClient.request<Asset[]>('assets', {
      method: 'GET',
      query: params,
    });
  },

  createAsset(payload: Partial<Asset>) {
    return httpClient.request<Asset>('assets', {
      method: 'POST',
      body: payload,
    });
  },

  updateAsset(id: string, payload: Partial<Asset>) {
    return httpClient.request<Asset>(`assets/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteAsset(id: string) {
    return httpClient.request<void>(`assets/${id}`, {
      method: 'DELETE',
    });
  },

  getImpactCodes(params?: { tenantId?: string }) {
    return httpClient.request<ImpactCode[]>('impact-codes', {
      method: 'GET',
      query: params,
    });
  },

  createImpactCode(payload: Partial<ImpactCode>) {
    return httpClient.request<ImpactCode>('impact-codes', {
      method: 'POST',
      body: payload,
    });
  },

  updateImpactCode(id: string, payload: Partial<ImpactCode>) {
    return httpClient.request<ImpactCode>(`impact-codes/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteImpactCode(id: string) {
    return httpClient.request<void>(`impact-codes/${id}`, {
      method: 'DELETE',
    });
  },

  getOEECodes(params?: { tenantId?: string }) {
    return httpClient.request<OEECode[]>('oee-codes', {
      method: 'GET',
      query: params,
    });
  },

  createOEECode(payload: Partial<OEECode>) {
    return httpClient.request<OEECode>('oee-codes', {
      method: 'POST',
      body: payload,
    });
  },

  updateOEECode(id: string, payload: Partial<OEECode>) {
    return httpClient.request<OEECode>(`oee-codes/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteOEECode(id: string) {
    return httpClient.request<void>(`oee-codes/${id}`, {
      method: 'DELETE',
    });
  },

  getProducts(params?: { organizationId?: string }) {
    return httpClient.request<Product[]>('products', {
      method: 'GET',
      query: params,
    });
  },

  createProduct(payload: Partial<Product>) {
    return httpClient.request<Product>('products', {
      method: 'POST',
      body: payload,
    });
  },

  updateProduct(id: string, payload: Partial<Product>) {
    return httpClient.request<Product>(`products/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteProduct(id: string) {
    return httpClient.request<void>(`products/${id}`, {
      method: 'DELETE',
    });
  },

  getRCACauseCodes(params?: { tenantId?: string; parentId?: string; root?: boolean }) {
    return httpClient.request<RCACauseCode[]>('rca-cause-codes', {
      method: 'GET',
      query: params,
    });
  },

  createRCACauseCode(payload: Partial<RCACauseCode>) {
    return httpClient.request<RCACauseCode>('rca-cause-codes', {
      method: 'POST',
      body: payload,
    });
  },

  updateRCACauseCode(id: string, payload: Partial<RCACauseCode>) {
    return httpClient.request<RCACauseCode>(`rca-cause-codes/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteRCACauseCode(id: string) {
    return httpClient.request<void>(`rca-cause-codes/${id}`, {
      method: 'DELETE',
    });
  },

  getReasonCodes(params?: { tenantId?: string; category?: string }) {
    return httpClient.request<ReasonCode[]>('reason-codes', {
      method: 'GET',
      query: params,
    });
  },

  createReasonCode(payload: Partial<ReasonCode>) {
    return httpClient.request<ReasonCode>('reason-codes', {
      method: 'POST',
      body: payload,
    });
  },

  updateReasonCode(id: string, payload: Partial<ReasonCode>) {
    return httpClient.request<ReasonCode>(`reason-codes/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteReasonCode(id: string) {
    return httpClient.request<void>(`reason-codes/${id}`, {
      method: 'DELETE',
    });
  },

  getVerificationStatusCodes(params?: { tenantId?: string }) {
    return httpClient.request<VerificationStatusCode[]>('verification-status-codes', {
      method: 'GET',
      query: params,
    });
  },

  createVerificationStatusCode(payload: Partial<VerificationStatusCode>) {
    return httpClient.request<VerificationStatusCode>('verification-status-codes', {
      method: 'POST',
      body: payload,
    });
  },

  updateVerificationStatusCode(id: string, payload: Partial<VerificationStatusCode>) {
    return httpClient.request<VerificationStatusCode>(`verification-status-codes/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteVerificationStatusCode(id: string) {
    return httpClient.request<void>(`verification-status-codes/${id}`, {
      method: 'DELETE',
    });
  },

  getEvidenceCategories(params?: { tenantId?: string }) {
    return httpClient.request<EvidenceCategory[]>('evidence-categories', {
      method: 'GET',
      query: params,
    });
  },

  createEvidenceCategory(payload: Partial<EvidenceCategory>) {
    return httpClient.request<EvidenceCategory>('evidence-categories', {
      method: 'POST',
      body: payload,
    });
  },

  updateEvidenceCategory(id: string, payload: Partial<EvidenceCategory>) {
    return httpClient.request<EvidenceCategory>(`evidence-categories/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteEvidenceCategory(id: string) {
    return httpClient.request<void>(`evidence-categories/${id}`, {
      method: 'DELETE',
    });
  },

  getEvidenceLocations(params?: { tenantId?: string }) {
    return httpClient.request<EvidenceLocation[]>('evidence-locations', {
      method: 'GET',
      query: params,
    });
  },

  createEvidenceLocation(payload: Partial<EvidenceLocation>) {
    return httpClient.request<EvidenceLocation>('evidence-locations', {
      method: 'POST',
      body: payload,
    });
  },

  updateEvidenceLocation(id: string, payload: Partial<EvidenceLocation>) {
    return httpClient.request<EvidenceLocation>(`evidence-locations/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteEvidenceLocation(id: string) {
    return httpClient.request<void>(`evidence-locations/${id}`, {
      method: 'DELETE',
    });
  },

  getRCATemplates(params?: { tenantId?: string; organizationId?: string; category?: string }) {
    return httpClient.request<RCATemplateDto[]>('rca-templates', {
      method: 'GET',
      query: params,
    });
  },

  createRCATemplate(payload: Partial<RCATemplateDto>) {
    return httpClient.request<RCATemplateDto>('rca-templates', {
      method: 'POST',
      body: payload,
    });
  },

  updateRCATemplate(id: string, payload: Partial<RCATemplateDto>) {
    return httpClient.request<RCATemplateDto>(`rca-templates/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteRCATemplate(id: string) {
    return httpClient.request<void>(`rca-templates/${id}`, {
      method: 'DELETE',
    });
  },
};


