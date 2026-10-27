import { useInfiniteQuery, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { AnalyticsResponse } from '../types/envelopes';
import type { LossStatementReportView, LossStatementRowView } from '../types/loss-statement';
import { sameTenantQuery } from './placeholder';
import { reportKey, type ReportQueryBase } from './reports';
import { STALE_TIME } from './stale-times';
import { stabilizeWindowParams } from './time-window';
import { useV2TenantId } from './use-v2-tenant';

/** `GET /reports/loss-statement` filters: the section's window, units and revision, and the page size. */
export interface LossStatementQuery extends ReportQueryBase {
  limit?: number;
}

export type LossStatementPage = AnalyticsResponse<LossStatementReportView>;

/** Most rows the CSV export reads (pages of 200); a 400-day window of three shifts per unit stays below it. */
const EXPORT_ROW_LIMIT = 20_000;
const EXPORT_PAGE = 200;

function paramsOf(query: LossStatementQuery, cursor: string | null): QueryParams {
  const params: Record<string, unknown> = {
    from: query.from,
    to: query.to,
    revision: query.approvedOnly ? 'approved' : 'provisional',
  };
  if (query.unitIds?.length) params.unitIds = query.unitIds;
  if (query.limit) params.limit = query.limit;
  if (cursor) params.cursor = cursor;
  return stabilizeWindowParams(params) as QueryParams;
}

async function fetchPage(query: LossStatementQuery, cursor: string | null, signal?: AbortSignal): Promise<LossStatementPage> {
  return (await v2Request<LossStatementPage>({ method: 'GET', path: '/reports/loss-statement', query: paramsOf(query, cursor), signal })).data;
}

/**
 * Task 13: the window's loss accounting statement and its keyset-paged rows (one per period), cached under
 * the report key family (realtime notices and mutations invalidate it). The total is the first page's; the
 * browser renders the server's figures only.
 */
export function useLossStatement(query: LossStatementQuery | null, tz?: string) {
  const tenantId = useV2TenantId();
  const enabled = Boolean(tenantId && query);
  return useInfiniteQuery<LossStatementPage, Error, InfiniteData<LossStatementPage, string | null>, QueryKey, string | null>({
    queryKey: query ? reportKey(tenantId ?? '-', 'loss-statement', query, tz) : ['v2', tenantId, 'reports', 'idle'],
    enabled,
    initialPageParam: null,
    staleTime: STALE_TIME.reports,
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) => (enabled && sameTenantQuery(tenantId, previousQuery) ? previous : undefined),
    queryFn: ({ pageParam, signal }) => fetchPage(query ?? { from: '', to: '' }, pageParam, signal),
    getNextPageParam: (last) => last.data.nextCursor ?? null,
  });
}

/** Every row of the window, page by page (the CSV export of approved figures); stops at the export bound. */
export async function fetchAllStatementRows(query: LossStatementQuery): Promise<LossStatementRowView[]> {
  const rows: LossStatementRowView[] = [];
  let cursor: string | null = null;
  do {
    const page: LossStatementPage = await fetchPage({ ...query, limit: EXPORT_PAGE }, cursor);
    rows.push(...page.data.items);
    cursor = page.data.nextCursor;
  } while (cursor && rows.length < EXPORT_ROW_LIMIT);
  return rows;
}
