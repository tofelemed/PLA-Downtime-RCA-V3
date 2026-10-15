import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import {
  assertBodyUnitsInScope,
  periodScopeUnits,
} from '../../periods/period-scope';
import { WeekStart } from '../../domain/calendar/week-start';
import { invalid, invalidReference } from '../../profiles/profile-errors';
import {
  DowntimeSelectionQueryDto,
  ReportWindowQueryDto,
} from './kpi-reports-v2.dto';

const MAX_DAYS = 400;
const DAY_MS = 86_400_000;

/** A validated report request: tenant, the units it may read, the window and the run selection. */
export interface ReportScope {
  tenantId: string;
  unitIds: string[];
  /** the caller's unit restriction (null = tenant-wide grant) */
  restricted: string[] | null;
  from: Date;
  to: Date;
  approvedOnly: boolean;
  /** the plant's first day of the week (week buckets, DT-10) */
  weekStart: WeekStart;
  /** downtime page filters: only periods of these products, shifts or crews (absent = every period) */
  selection?: PeriodSelection;
}

export interface PeriodSelection {
  productIds?: string[];
  shiftNames?: string[];
  crewIds?: string[];
}

const distinct = (values: string[] | undefined) =>
  values?.length ? [...new Set(values)].sort() : undefined;

/** The period selection of a request (only lists that were given; none = undefined). */
export function selectionOf(
  query: Partial<DowntimeSelectionQueryDto>,
): PeriodSelection | undefined {
  const selection: PeriodSelection = {};
  const productIds = distinct(query.productIds);
  const shiftNames = distinct(query.shiftNames);
  const crewIds = distinct(query.crewIds);
  if (productIds) selection.productIds = productIds;
  if (shiftNames) selection.shiftNames = shiftNames;
  if (crewIds) selection.crewIds = crewIds;
  return Object.keys(selection).length > 0 ? selection : undefined;
}

/**
 * Report authorization (WF05): the tenant comes from identity; named units must be units of the tenant and
 * of the caller's scope (422 INVALID_REFERENCE, no existence leak); without units a unit-limited caller is
 * restricted to its own units (never a tenant-wide aggregate), a tenant-wide caller reads every unit.
 */
export async function resolveReportScope(
  manager: EntityManager,
  context: RequestContext,
  query: ReportWindowQueryDto & Partial<DowntimeSelectionQueryDto>,
): Promise<ReportScope> {
  const tenantId = requireTenantId(context);
  const from = new Date(query.from);
  const to = new Date(query.to);
  if (!(from < to)) throw invalid('INVALID_RANGE', 'from must be before to');
  if (to.getTime() - from.getTime() > MAX_DAYS * DAY_MS) {
    throw invalid(
      'WINDOW_TOO_LARGE',
      `report at most ${MAX_DAYS} days at once`,
    );
  }
  const restricted = periodScopeUnits(context);
  const named = query.unitIds?.length ? [...new Set(query.unitIds)] : null;
  if (named) {
    assertBodyUnitsInScope(context, named);
    const found = await tenantUnits(manager, tenantId, named);
    if (found.length !== named.length)
      throw invalidReference('unitIds', 'unit');
  }
  const unitIds =
    named ?? restricted ?? (await tenantUnits(manager, tenantId, null));
  return {
    tenantId,
    unitIds: [...unitIds].sort(),
    restricted,
    from,
    to,
    approvedOnly: query.approvedOnly ?? false,
    weekStart: await tenantWeekStart(manager, tenantId),
    selection: selectionOf(query),
  };
}

async function tenantWeekStart(
  manager: EntityManager,
  tenantId: string,
): Promise<WeekStart> {
  const [row]: Array<{ week_start: WeekStart }> = await manager.query(
    `SELECT "week_start" FROM "tenants" WHERE "id"::text = $1::text`,
    [tenantId],
  );
  return row?.week_start ?? 'monday';
}

async function tenantUnits(
  manager: EntityManager,
  tenantId: string,
  ids: string[] | null,
): Promise<string[]> {
  const rows: Array<{ id: string }> = await manager.query(
    `SELECT "id" FROM "units" WHERE "tenant_id" = $1 AND ($2::uuid[] IS NULL OR "id" = ANY($2::uuid[]))`,
    [tenantId, ids],
  );
  return rows.map((r) => r.id);
}

/** Asset ids must be assets of the tenant on a unit of the report (422 INVALID_REFERENCE). */
export async function resolveAssets(
  manager: EntityManager,
  scope: ReportScope,
  assetIds: readonly string[],
): Promise<Map<string, string>> {
  const rows: Array<{ id: string; unit_id: string }> = await manager.query(
    `SELECT "id", "unit_id" FROM "assets" WHERE "tenant_id" = $1::uuid AND "id" = ANY($2::uuid[])`,
    [scope.tenantId, [...new Set(assetIds)]],
  );
  const units = new Set(scope.unitIds);
  const inScope = rows.filter((r) => units.has(r.unit_id));
  if (inScope.length !== new Set(assetIds).size)
    throw invalidReference('assetIds', 'asset');
  return new Map(inScope.map((r) => [r.id, r.unit_id]));
}
