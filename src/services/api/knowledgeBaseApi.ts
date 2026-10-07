import { httpClient } from './httpClient';

export interface KnowledgeBaseRecommendationDto {
  id: string;
  description: string;
  effectiveness: string;
  implementationCost?: number;
  implementationTime?: number;
}

export interface KnowledgeBaseEntryDto {
  id: string;
  tenantId?: string;
  organizationId?: string;
  rcaId: string;
  title: string;
  description?: string;
  problemStatement?: string;
  eventType?: string;
  unitId?: string;
  unitName?: string;
  assetId?: string;
  assetName?: string;
  equipmentCategory?: string;
  category?: string;
  symptoms?: string[];
  impactCodes?: string[];
  oeeCodes?: string[];
  rootCause?: string;
  rootCauseCategory?: string;
  contributingFactors?: string[];
  recommendations?: KnowledgeBaseRecommendationDto[];
  recurrenceCount?: number;
  effectiveness?: number;
  costSaved?: number | null;
  downtimeReduced?: number | null;
  keywords?: string[];
  tags?: string[];
  content?: string;
  relatedRcas?: string[];
  author?: string;
  isPublished?: boolean;
  timesReferenced?: number;
  helpfulVotes?: number;
  closedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateKnowledgeBasePayload = Omit<
  KnowledgeBaseEntryDto,
  'id' | 'createdAt' | 'updatedAt' | 'timesReferenced' | 'helpfulVotes'
> & {
  rcaId: string;
  title: string;
  timesReferenced?: number;
  helpfulVotes?: number;
};

export type UpdateKnowledgeBasePayload = Partial<CreateKnowledgeBasePayload>;

export const knowledgeBaseApi = {
  getEntries(params?: { tenantId?: string; organizationId?: string; category?: string }) {
    return httpClient.request<KnowledgeBaseEntryDto[]>('rca-knowledge-base', {
      method: 'GET',
      query: params,
    });
  },

  getEntry(id: string) {
    return httpClient.request<KnowledgeBaseEntryDto>(`rca-knowledge-base/${id}`, {
      method: 'GET',
    });
  },

  createEntry(payload: CreateKnowledgeBasePayload) {
    return httpClient.request<KnowledgeBaseEntryDto>('rca-knowledge-base', {
      method: 'POST',
      body: payload,
    });
  },

  updateEntry(id: string, payload: UpdateKnowledgeBasePayload) {
    return httpClient.request<KnowledgeBaseEntryDto>(`rca-knowledge-base/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  deleteEntry(id: string) {
    return httpClient.request<void>(`rca-knowledge-base/${id}`, {
      method: 'DELETE',
    });
  },
};


