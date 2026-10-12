import type { AuditFilters } from '@/api/v2/queries/administration-audit';
import { ALL } from '@/features/admin/shared/filter-select';

/** Filters of the audit page as kept in the URL (strings; `from` / `to` are UTC instants). */
export interface AuditUrlFilters {
  from: string;
  to: string;
  q: string;
  action: string;
  entity: string;
}

export function toAuditFilters(values: AuditUrlFilters): AuditFilters {
  return {
    from: values.from || undefined,
    to: values.to || undefined,
    q: values.q || undefined,
    actions: values.action === ALL ? undefined : [values.action],
    entityTypes: values.entity === ALL ? undefined : [values.entity],
  };
}

/** `audit-log-<from day>-to-<to day>.csv` (exports stay ISO / UTC). */
export function exportFileName(filters: AuditFilters): string {
  const day = (iso?: string) => (iso ? iso.slice(0, 10) : 'all');
  return `audit-log-${day(filters.from)}-to-${day(filters.to)}.csv`;
}
