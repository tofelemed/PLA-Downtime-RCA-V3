import type { AuditFilters } from '@/api/v2/queries/administration-audit';
import { ALL } from '@/features/admin/shared/filter-select';
import { exportFileName, plantFileDay } from '@/features/ux-kit/format/export-file-name';

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

/**
 * `traverse-forge-audit-log-<from day>-to-<last day>.csv`: plant days in the name, ISO / UTC times inside. `to`
 * is the exclusive end, so the name shows the last day included (the day of `to` − 1 ms).
 */
export function auditExportFileName(filters: AuditFilters, timezone: string): string {
  const end = Date.parse(filters.to);
  const last = Number.isNaN(end) ? filters.to : new Date(end - 1).toISOString();
  return exportFileName(['audit-log', plantFileDay(filters.from, timezone), 'to', plantFileDay(last, timezone)]);
}
