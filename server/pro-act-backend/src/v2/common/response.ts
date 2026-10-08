/** Response envelopes shared by every v2 endpoint (spec API03). */

export interface ListScope {
  tenantId: string;
  siteIds?: string[];
  unitIds?: string[];
}

export interface ListResponse<T> {
  items: T[];
  /** null on the last page */
  nextCursor: string | null;
  /** server time the page was produced (ISO 8601) */
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
  /** 0..1 share of the window backed by observations */
  ratio: number;
}

/** Added to every analytical response; values are strings for decimals (`@DecimalString`). */
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

/** 202 body for long-running operations (API04). */
export interface JobAccepted {
  jobId: string;
  statusUrl: string;
}

export function listResponse<T>(
  items: T[],
  nextCursor: string | null,
  scope: ListScope,
): ListResponse<T> {
  return { items, nextCursor, asOf: new Date().toISOString(), scope };
}
