import { EntityManager, Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { spansOperationalDay } from '../../periods/day-grain';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { LossBasis } from '../../periods/loss-accounting-policy';
import { CursorCodec, invalidCursor } from '../common/cursor-codec';
import { PeriodState } from '../period-overview/period-states';
import { planIdOf } from '../periods/period-plan-ids';
import { ReportScope } from '../reports/report-scope';
import {
  LossStatementView,
  PeriodStatement,
  statementView,
} from './loss-statement';

/** One row of the statement report: a period (a day, or a shift grouped under its day) with its statement. */
export interface LossStatementRowView {
  periodId: string;
  /** plan of the period's selected plan version (opens the period page); null = no plan */
  planId: string | null;
  unitId: string;
  unitName: string | null;
  localDate: string;
  shiftName: string | null;
  /** `day`: the period spans its whole operational day (daily accounting grain), else `shift` */
  grain: 'day' | 'shift';
  /** loss basis of the shown revision's run; null without a run */
  basis: LossBasis | null;
  /** null: no revision shown (approved only and none approved, or never calculated) */
  revisionState: 'approved' | 'provisional' | null;
  /** null: nothing to state yet (no run) */
  statement: LossStatementView | null;
}

interface RowKey {
  localDate: string;
  utcStart: string;
  id: string;
}

const SEPARATOR = '|';

function decodeCursor(cursor: string): RowKey {
  const payload = CursorCodec.decode(cursor);
  const [localDate, utcStart] = String(payload.sortValue ?? '').split(
    SEPARATOR,
  );
  if (!localDate || !utcStart || Number.isNaN(Date.parse(utcStart)))
    throw invalidCursor();
  return { localDate, utcStart, id: payload.id };
}

export function rowCursor(period: ProductionPeriod): string {
  return CursorCodec.encode({
    sortValue: `${period.localDate}${SEPARATOR}${period.utcStart.toISOString()}`,
    id: period.id,
  });
}

/**
 * One keyset page of the scope's periods in (local date, start, id) order — tenant and unit scope from
 * identity (`scopedQuery`), the scope's units, period start in [from, to) — `limit + 1` rows so the caller
 * knows whether a next page exists.
 */
export function statementRowPage(
  periods: Repository<ProductionPeriod>,
  input: {
    context: RequestContext;
    scope: ReportScope;
    cursor?: string;
    limit: number;
  },
): Promise<ProductionPeriod[]> {
  const { context, scope } = input;
  const query = scopedQuery(periods, 'p', { context, unitProperty: 'unitId' })
    .andWhere('p.unitId IN (:...unitIds)', { unitIds: scope.unitIds })
    .andWhere('p.utcStart >= :from AND p.utcStart < :to', {
      from: scope.from,
      to: scope.to,
    });
  if (input.cursor) {
    const after = decodeCursor(input.cursor);
    query.andWhere(
      '(p.localDate, p.utcStart, p.id) > (CAST(:afterDate AS date), CAST(:afterStart AS timestamptz), CAST(:afterId AS uuid))',
      {
        afterDate: after.localDate,
        afterStart: after.utcStart,
        afterId: after.id,
      },
    );
  }
  return query
    .orderBy('p.localDate', 'ASC')
    .addOrderBy('p.utcStart', 'ASC')
    .addOrderBy('p.id', 'ASC')
    .limit(input.limit + 1)
    .getMany();
}

/** Unit names of a page (one tenant-guarded query). */
export async function unitNames(
  manager: EntityManager,
  tenantId: string,
  unitIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(unitIds)];
  if (ids.length === 0) return new Map();
  const rows = await manager.query<Array<{ id: string; name: string }>>(
    `SELECT "id"::text AS "id", "name" FROM "units" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
    [tenantId, ids],
  );
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** The row of a period state and its statement. */
export function statementRow(
  state: PeriodState,
  statement: PeriodStatement | null,
  lookups: {
    plans: ReadonlyMap<string, string>;
    units: ReadonlyMap<string, string>;
  },
): LossStatementRowView {
  const { period, revision } = state;
  return {
    periodId: period.id,
    planId: planIdOf(period, lookups.plans),
    unitId: period.unitId,
    unitName: lookups.units.get(period.unitId) ?? null,
    localDate: period.localDate,
    shiftName: period.shiftName,
    grain: spansOperationalDay(period.utcStart, period.utcEnd)
      ? 'day'
      : 'shift',
    basis: state.run ? state.lossBasis : null,
    revisionState: revision
      ? revision.lifecycle === 'approved'
        ? 'approved'
        : 'provisional'
      : null,
    statement: statement ? statementView(statement) : null,
  };
}
