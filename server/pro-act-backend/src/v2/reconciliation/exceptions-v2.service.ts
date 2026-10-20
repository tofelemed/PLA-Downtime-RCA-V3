import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { restrictedUnitIds } from '../../common/query/scoped-query';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { invalid } from '../../profiles/profile-errors';
import { CursorCodec, invalidCursor } from '../common/cursor-codec';
import { namedReportUnits } from '../reports/report-scope';
import {
  ExceptionRow,
  ExceptionsFilter,
  exceptionsQuery,
} from './exceptions-sql';
import {
  EXCEPTION_TYPES,
  EXCEPTION_WORKFLOWS,
  ExceptionType,
  ReconciliationExceptionsQueryDto,
} from './exceptions-v2.dto';
import {
  ReconciliationExceptionV2View,
  toExceptionView,
} from './exceptions-v2.view';

const MAX_DAYS = 400;
const DAY_MS = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ExceptionsPage {
  items: ReconciliationExceptionV2View[];
  nextCursor: string | null;
  /** the unit restriction applied (null = every unit of the tenant) */
  unitIds: string[] | null;
}

const isType = (value: string): value is ExceptionType =>
  (EXCEPTION_TYPES as readonly string[]).includes(value);

/** The keyset position of a cursor: period start, period id and type of the last row (400 INVALID_CURSOR). */
function decodeAfter(cursor: string | undefined): ExceptionsFilter['after'] {
  if (!cursor) return null;
  const { sortValue, id } = CursorCodec.decode(cursor);
  const [periodId = '', type = ''] = id.split(':');
  if (typeof sortValue !== 'string' || Number.isNaN(Date.parse(sortValue))) {
    throw invalidCursor();
  }
  if (!UUID.test(periodId) || !isType(type)) throw invalidCursor();
  return { utcStart: sortValue, periodId, type };
}

function assertWindow(fromDate: string, toDate: string): void {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || !(from < to)) {
    throw invalid('INVALID_RANGE', 'fromDate must be a date before toDate');
  }
  if (to - from > MAX_DAYS * DAY_MS) {
    throw invalid('WINDOW_TOO_LARGE', `list at most ${MAX_DAYS} days at once`);
  }
}

/**
 * Plan 2.4 accounting exceptions queue: every open problem of the periods of a window that are not approved,
 * read from stored state only (the latest run's slice flags, the stale mark, the actuals' substitution flag,
 * the stops and the duplicate-stop suggestions), scoped by the request context, keyset-paginated.
 */
@Injectable()
export class ReconciliationExceptionsService {
  constructor(
    @InjectRepository(ProductionPeriod)
    private readonly periods: Repository<ProductionPeriod>,
  ) {}

  async page(
    context: RequestContext,
    query: ReconciliationExceptionsQueryDto,
  ): Promise<ExceptionsPage> {
    const tenantId = requireTenantId(context);
    assertWindow(query.fromDate, query.toDate);
    const named = await namedReportUnits(
      this.periods.manager,
      context,
      query.unitIds,
    );
    const unitIds = named ?? restrictedUnitIds(context, tenantId);
    const filter: ExceptionsFilter = {
      tenantId,
      unitIds,
      fromDate: query.fromDate,
      toDate: query.toDate,
      types: query.types?.length ? [...new Set(query.types)] : EXCEPTION_TYPES,
      workflows: query.workflowStates?.length
        ? [...new Set(query.workflowStates)]
        : EXCEPTION_WORKFLOWS,
      after: decodeAfter(query.cursor),
      limit: query.limit,
    };
    const { sql, values } = exceptionsQuery(filter);
    const rows: ExceptionRow[] = await this.periods.manager.query(sql, values);
    const page = rows.slice(0, query.limit).map(toExceptionView);
    const last = page[page.length - 1];
    return {
      items: page,
      nextCursor:
        rows.length > query.limit && last
          ? CursorCodec.encode({ sortValue: last.utcStart, id: last.id })
          : null,
      unitIds,
    };
  }
}
