import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AUDIT_READERS } from '../../audit-log/audit-roles';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { restrictedUnitIds } from '../../common/query/scoped-query';
import { invalid } from '../../profiles/profile-errors';
import { ActivitySummaryQueryDto } from './activity-summary-v2.dto';
import {
  AUDIT_CELLS_SQL,
  AuditCell,
  foldAudit,
  foldWorkItems,
  RCA_CELLS_SQL,
  TASK_CELLS_SQL,
  TIMEZONE_SQL,
  WorkItemCell,
} from './activity-summary.sql';
import { ActivitySummaryResponse } from './activity-summary.view';

const MAX_DAYS = 400;
const DAY_MS = 86_400_000;

/** True when the caller may read the tenant's audit log (the `GET /audit-logs` role set). */
export function canReadAudit(context: RequestContext): boolean {
  const readers: readonly string[] = AUDIT_READERS;
  return (
    context.isSuperAdmin || context.roles.some((role) => readers.includes(role))
  );
}

/** The validated window: `from < to`, at most 400 days (422 otherwise). */
export function activityWindow(query: ActivitySummaryQueryDto): {
  from: Date;
  to: Date;
} {
  const from = new Date(query.from);
  const to = new Date(query.to);
  if (!(from < to)) throw invalid('INVALID_RANGE', 'from must be before to');
  if (to.getTime() - from.getTime() > MAX_DAYS * DAY_MS) {
    throw invalid(
      'WINDOW_TOO_LARGE',
      `summary at most ${MAX_DAYS} days at once`,
    );
  }
  return { from, to };
}

/**
 * Work-item and audit activity of a window (the v1 Reports RCA / task / audit summaries, on v2): RCA cases
 * and tasks created in `[from, to)` by status, priority and plant-local day with open and overdue counts,
 * and — for audit readers only — audit entries by action, entity type and day. Tenant from identity, RCA
 * cases limited to a unit-limited caller's units; counted in SQL, no record is loaded.
 */
@Injectable()
export class ActivitySummaryV2Service {
  constructor(private readonly dataSource: DataSource) {}

  async summary(
    context: RequestContext,
    query: ActivitySummaryQueryDto,
    asOf: Date = new Date(),
  ): Promise<ActivitySummaryResponse> {
    const tenantId = requireTenantId(context);
    const { from, to } = activityWindow(query);
    const manager = this.dataSource.manager;
    const zone: Array<{ timezone: string }> = await manager.query(
      TIMEZONE_SQL,
      [tenantId],
    );
    const timezone = zone[0]?.timezone ?? 'UTC';
    const window = [tenantId, from, to, timezone];
    const units = restrictedUnitIds(context, tenantId);
    const [rca, tasks, audit] = await Promise.all([
      manager.query<WorkItemCell[]>(RCA_CELLS_SQL, [...window, asOf, units]),
      manager.query<WorkItemCell[]>(TASK_CELLS_SQL, [...window, asOf]),
      canReadAudit(context)
        ? manager.query<AuditCell[]>(AUDIT_CELLS_SQL, window)
        : Promise.resolve(null),
    ]);
    return {
      data: {
        timezone,
        rcaCases: foldWorkItems(rca),
        tasks: foldWorkItems(tasks),
        audit: audit ? foldAudit(audit) : null,
      },
      asOf: asOf.toISOString(),
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }
}
