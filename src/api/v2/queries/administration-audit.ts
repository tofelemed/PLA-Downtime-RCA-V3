import type { QueryParams } from '../request-url';
import type { AuditEntryView, AuditSummaryView } from '../types/administration';
import { adminCall, compactQuery, useAdminRead, useAdminRecord } from './administration-shared';
import { usePagedQuery } from './use-paged-query';

/** Most rows one audit CSV export carries (backend `AUDIT_EXPORT_MAX_ROWS`). */
export const AUDIT_EXPORT_MAX_ROWS = 10_000;

/** Server filters of the audit trail; `from` / `to` bound the entry time (half-open, UTC instants). */
export interface AuditFilters {
  from?: string;
  to?: string;
  q?: string;
  actions?: readonly string[];
  entityTypes?: readonly string[];
  userIds?: readonly string[];
  entityId?: string;
}

const toQuery = (filters: AuditFilters): QueryParams => compactQuery({ ...filters });

/** The plant's audit trail, newest first, 20 per page (keyset). */
export function useAuditPage(filters: AuditFilters) {
  const query = toQuery(filters);
  return usePagedQuery<AuditEntryView>({
    resource: 'audit-logs',
    path: '/audit-logs',
    query,
    key: { window: { from: filters.from, to: filters.to }, filters: query },
  });
}

/** Counts by action, entity type and day of the filtered entries (server). */
export const useAuditSummary = (filters: AuditFilters) =>
  useAdminRead<AuditSummaryView>('audit-logs', '/audit-logs/summary', toQuery(filters));

export const useAuditEntry = (id: string | null | undefined) =>
  useAdminRecord<AuditEntryView>('audit-logs', id, `/audit-logs/${id ?? ''}`);

/** The filtered entries as CSV text (ISO / UTC times; at most `AUDIT_EXPORT_MAX_ROWS` rows). */
export function fetchAuditCsv(filters: AuditFilters): Promise<string> {
  return adminCall<string>('GET', '/audit-logs/export', { query: toQuery(filters) });
}
