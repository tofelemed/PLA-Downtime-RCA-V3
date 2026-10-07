// PI Web API client — routes all requests through the backend when tenantId is provided.

import { piBrowserApi } from '../api/piBrowserApi';

export type PIAuth = {
  type: 'basic';
  username: string;
  password: string;
};

export interface PIClientOptions {
  tenantId?: string;
  basePath?: string;
  baseUrl?: string;
  authProvider?: () => Promise<HeadersInit>;
}

export class PIClient {
  private baseUrl: string;
  private authProvider: () => Promise<HeadersInit>;
  readonly tenantId?: string;

  constructor(opts: PIClientOptions) {
    this.tenantId = opts.tenantId;

    if (opts.baseUrl) {
      let url = opts.baseUrl.endsWith('/') ? opts.baseUrl.slice(0, -1) : opts.baseUrl;
      if (!url.endsWith('/piwebapi')) {
        url = url.endsWith('/piwebapi/')
          ? url.slice(0, -1)
          : url.includes('/piwebapi')
            ? url
            : `${url}/piwebapi`;
      }
      this.baseUrl = url;
    } else if (opts.basePath) {
      const basePath = opts.basePath;
      if (basePath.startsWith('http://') || basePath.startsWith('https://')) {
        let url = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
        if (!url.endsWith('/piwebapi')) {
          url = url.includes('/piwebapi') ? url : `${url}/piwebapi`;
        }
        this.baseUrl = url;
      } else {
        this.baseUrl = basePath.startsWith('/') ? basePath : `/${basePath}`;
      }
    } else {
      this.baseUrl = '/piwebapi';
    }

    this.authProvider = opts.authProvider || (async () => ({}));
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (this.tenantId) {
      return piBrowserApi.request<T>(this.tenantId, {
        path: normalizedPath,
        method: (init?.method as any) || 'GET',
      });
    }

    const headers = new Headers({ Accept: 'application/json' });
    const authHeaders = await this.authProvider();
    Object.entries(authHeaders).forEach(([k, v]) => headers.set(k, String(v)));

    const fullUrl = this.baseUrl.startsWith('http')
      ? `${this.baseUrl}${normalizedPath}`
      : `${this.baseUrl}${normalizedPath}`;

    try {
      const resp = await fetch(fullUrl, {
        ...init,
        headers,
        credentials: 'omit',
        mode: 'cors',
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        const error = new Error(`PI request failed ${resp.status}: ${text}`);
        (error as any).status = resp.status;
        (error as any).statusText = resp.statusText;
        (error as any).url = resp.url;
        throw error;
      }

      return resp.json() as Promise<T>;
    } catch (error) {
      if ((error as any).status) throw error;
      const networkError = new Error(
        `PI request failed: ${error instanceof Error ? error.message : 'Network error'}`,
      );
      (networkError as any).status = 0;
      throw networkError;
    }
  }

  // --- AF / Asset Server ---
  getAssetServers() {
    return this.request<any>('/assetservers');
  }

  getAFDatabases(assetServerWebId: string) {
    return this.request<any>(`/assetservers/${encodeURIComponent(assetServerWebId)}/assetdatabases`);
  }

  getDatabaseElements(databaseWebId: string) {
    return this.request<any>(`/assetdatabases/${encodeURIComponent(databaseWebId)}/elements`);
  }

  getElement(webId: string) {
    return this.request<any>(`/elements/${encodeURIComponent(webId)}`);
  }

  getElementChildren(webId: string) {
    return this.request<any>(`/elements/${encodeURIComponent(webId)}/elements`);
  }

  getElementAttributes(webId: string, selectedFields?: string) {
    const qp = new URLSearchParams();
    if (selectedFields) qp.set('selectedFields', selectedFields);
    const suffix = qp.toString() ? `?${qp.toString()}` : '';
    return this.request<any>(`/elements/${encodeURIComponent(webId)}/attributes${suffix}`);
  }

  getAttributeValue(attributeWebId: string) {
    return this.request<any>(`/attributes/${encodeURIComponent(attributeWebId)}/value`);
  }

  getStreamValue(streamWebId: string) {
    return this.request<any>(`/streams/${encodeURIComponent(streamWebId)}/value`);
  }

  // --- Streams (Time Series) ---
  getStreamRecorded(streamWebId: string, params: {
    startTimeUtc: string;
    endTimeUtc: string;
    maxCount?: number;
    boundaryType?: 'Inside'|'Outside'|'Exact'|'Interpolated';
    includeBad?: boolean;
    filter?: string;
    selectedFields?: string;
  }) {
    const qp = new URLSearchParams();
    qp.set('startTime', params.startTimeUtc);
    qp.set('endTime', params.endTimeUtc);
    if (params.maxCount) qp.set('maxCount', String(params.maxCount));
    if (params.boundaryType) qp.set('boundaryType', params.boundaryType);
    if (typeof params.includeBad !== 'undefined') qp.set('includeBad', String(params.includeBad));
    if (params.filter) qp.set('filterExpression', params.filter);
    if (params.selectedFields) qp.set('selectedFields', params.selectedFields);
    return this.request<any>(`/streams/${encodeURIComponent(streamWebId)}/recorded?${qp.toString()}`);
  }

  getStreamInterpolated(streamWebId: string, params: {
    startTimeUtc: string;
    endTimeUtc: string;
    interval: string; // e.g., '1m', '5m'
    filter?: string;
    selectedFields?: string;
  }) {
    const qp = new URLSearchParams();
    qp.set('startTime', params.startTimeUtc);
    qp.set('endTime', params.endTimeUtc);
    qp.set('interval', params.interval);
    if (params.filter) qp.set('filterExpression', params.filter);
    if (params.selectedFields) qp.set('selectedFields', params.selectedFields);
    return this.request<any>(`/streams/${encodeURIComponent(streamWebId)}/interpolated?${qp.toString()}`);
  }

  getStreamSummary(streamWebId: string, params: {
    startTimeUtc: string;
    endTimeUtc: string;
    summaryTypes: string; // e.g., 'Average;Minimum;Maximum;Total;Count'
    calculationBasis?: 'TimeWeighted'|'EventWeighted';
    timeType?: 'Auto'|'EventWeighted'|'TimeWeighted';
    interval?: string; // for interval summaries
    selectedFields?: string;
  }) {
    const qp = new URLSearchParams();
    qp.set('startTime', params.startTimeUtc);
    qp.set('endTime', params.endTimeUtc);
    qp.set('summaryType', params.summaryTypes);
    if (params.calculationBasis) qp.set('calculationBasis', params.calculationBasis);
    if (params.timeType) qp.set('timeType', params.timeType);
    if (params.interval) qp.set('interval', params.interval);
    if (params.selectedFields) qp.set('selectedFields', params.selectedFields);
    return this.request<any>(`/streams/${encodeURIComponent(streamWebId)}/summary?${qp.toString()}`);
  }

  getStreamPlot(streamWebId: string, params: {
    startTimeUtc: string;
    endTimeUtc: string;
    intervals: number;
    selectedFields?: string;
  }) {
    const qp = new URLSearchParams();
    qp.set('startTime', params.startTimeUtc);
    qp.set('endTime', params.endTimeUtc);
    qp.set('intervals', String(params.intervals));
    if (params.selectedFields) qp.set('selectedFields', params.selectedFields);
    return this.request<any>(`/streams/${encodeURIComponent(streamWebId)}/plot?${qp.toString()}`);
  }

  // Accepts absolute PI Web API links or relative paths
  getByLink(urlOrPath: string) {
    try {
      const url = new URL(urlOrPath);
      const pathname = url.pathname;
      const rel = pathname.startsWith('/piwebapi') ? pathname.substring('/piwebapi'.length) : pathname;
      return this.request<any>(rel);
    } catch {
      // Not an absolute URL; assume relative to /piwebapi
      const rel = urlOrPath.startsWith('/piwebapi') ? urlOrPath.substring('/piwebapi'.length) : urlOrPath;
      return this.request<any>(rel);
    }
  }

  // Helper to extract stream WebId from an Attribute object if available.
  // Uses Links.Value (Streams/{webId}/value) or Links.Point (for PI Point-backed attributes).
  async resolveAttributeStreamWebId(attribute: any): Promise<string | null> {
    try {
      const linkValue: string | undefined = attribute?.Links?.Value;
      if (linkValue) {
        // Expect /piwebapi/streams/{webId}/value
        const url = new URL(linkValue, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        const parts = url.pathname.split('/').filter(Boolean);
        const idx = parts.findIndex(p => p.toLowerCase() === 'streams');
        if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      }
    } catch {}
    try {
      const linkPoint: string | undefined = attribute?.Links?.Point;
      if (linkPoint) {
        // Fetch the point resource and derive WebId
        const point = await this.getByLink(linkPoint);
        if (point?.WebId) return point.WebId;
      }
    } catch {}
    if (attribute?.WebId) return attribute.WebId; // fallback to attribute webid (works for /attributes/{id}/value)
    return null;
  }

  // --- Event Frames ---
  getEventFrames(params: {
    databaseWebId?: string; // or elementWebId
    elementWebId?: string;
    startTimeUtc: string;
    endTimeUtc: string;
    templateName?: string;
    maxCount?: number;
    selectedFields?: string; // PI Web API: e.g., Items.Name;Items.TemplateName;Items.WebId;Items.StartTime;Items.EndTime;Items.PrimaryReferencedElement.WebId
    startIndex?: number; // for paging
  }) {
    const qp = new URLSearchParams();
    qp.set('startTime', params.startTimeUtc);
    qp.set('endTime', params.endTimeUtc);
    qp.set('sortField', 'StartTime');
    qp.set('sortOrder', 'Ascending');
    if (params.templateName) qp.set('templateName', params.templateName);
    if (params.maxCount) qp.set('maxCount', String(params.maxCount));
    if (params.selectedFields) qp.set('selectedFields', params.selectedFields);
    if (typeof params.startIndex === 'number') qp.set('startIndex', String(params.startIndex));
    if (params.databaseWebId) {
      return this.request<any>(`/assetdatabases/${encodeURIComponent(params.databaseWebId)}/eventframes?${qp.toString()}`);
    }
    if (params.elementWebId) {
      return this.request<any>(`/elements/${encodeURIComponent(params.elementWebId)}/eventframes?${qp.toString()}`);
    }
    throw new Error('Either databaseWebId or elementWebId is required');
  }

  getEventFrame(webId: string) {
    return this.request<any>(`/eventframes/${encodeURIComponent(webId)}`);
  }

  getEventFrameAttributes(webId: string) {
    return this.request<any>(`/eventframes/${encodeURIComponent(webId)}/attributes`);
  }
}

// Helper to build Basic Auth header at runtime
export function basicAuthHeader(username: string, password: string): HeadersInit {
  // Note: btoa may fail for unicode; in such cases, use a proper encoder.
  const token = btoa(`${username}:${password}`);
  return { Authorization: `Basic ${token}` };
}

/** Route all PI Web API calls through the backend proxy for a tenant */
export function createTenantPIClient(tenantId: string): PIClient {
  return new PIClient({ tenantId });
}

