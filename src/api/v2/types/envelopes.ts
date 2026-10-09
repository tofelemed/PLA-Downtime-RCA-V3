/**
 * Response envelopes of every v2 endpoint (backend `src/v2/common/response.ts`, spec API03). The OpenAPI
 * snapshot does not describe response bodies yet, so these mirror the backend view files by hand.
 */
export interface ListScope {
  tenantId: string;
  siteIds?: string[];
  unitIds?: string[];
}

export interface ListResponse<T> {
  items: T[];
  /** null on the last page */
  nextCursor: string | null;
  asOf: string;
  scope: ListScope;
}

export interface DataQuality {
  missingCount: number;
  provisionalCount: number;
  notes?: string[];
}

export interface Coverage {
  from: string;
  to: string;
  /** 0..1 share of the window backed by data */
  ratio: number;
}

export interface AnalyticsResponse<T> {
  data: T;
  calculationRunId: string | null;
  policyVersion: string | null;
  dataQuality: DataQuality;
  coverage: Coverage;
  isProvisional: boolean;
  asOf: string;
  scope: ListScope;
}

/** 202 body of long-running commands (API04). */
export interface JobAccepted {
  jobId: string;
  statusUrl: string;
}
