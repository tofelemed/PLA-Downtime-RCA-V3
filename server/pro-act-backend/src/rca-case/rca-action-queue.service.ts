import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { CursorCodec } from '../v2/common/cursor-codec';
import { listResponse, ListResponse } from '../v2/common/response';
import { RcaActionV2ListQueryDto } from '../v2/rca/rca-actions-v2.dto';
import { linkedTasks } from './action-tasks';
import { toActionView } from './rca-action.view';
import {
  actionQueueConditions,
  actionQueueCursor,
  RcaActionQueueItemV2View,
} from './rca-action-queue';
import { scopeOf } from './rca-scope';

/**
 * F-7 cross-case action list ("My actions"): the actions of every case in the caller's scope, each with
 * its case's id, title, status and unit read in the same query, due date first (keyset over
 * `(due_date, id)` with undated actions last; `IDX_rca_actions_tenant_owner_due` / `_tenant_due`).
 */
@Injectable()
export class RcaActionQueueService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(
    context: RequestContext,
    query: RcaActionV2ListQueryDto,
  ): Promise<ListResponse<RcaActionQueueItemV2View>> {
    const scope = scopeOf(context);
    const qb = scopedQuery(this.dataSource.getRepository(RcaAction), 'a', {
      context,
    })
      .innerJoin('a.rca', 'rca', 'rca.tenantId = a.tenantId')
      .addSelect(['rca.id', 'rca.title', 'rca.status', 'rca.unitId']);
    for (const condition of actionQueueConditions(query, scope))
      qb.andWhere(condition.sql, condition.params);
    if (query.cursor) {
      const cursor = actionQueueCursor(query.cursor);
      qb.andWhere(cursor.sql, cursor.params);
    }
    const rows = await qb
      .orderBy('a.dueDate', 'ASC', 'NULLS LAST')
      .addOrderBy('a.id', 'ASC')
      .limit(query.limit + 1)
      .getMany();
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > query.limit && last ? await this.cursorAfter(last) : null;
    const now = new Date();
    const tasks = await linkedTasks(
      this.dataSource.manager,
      scope.tenantId,
      items.map((action) => action.id),
    );
    return listResponse(
      items.map((action) => ({
        ...toActionView(action, now, tasks.get(action.id)),
        case: {
          id: action.rcaId,
          title: action.rca?.title ?? '',
          status: action.rca?.status ?? null,
          unitId: action.rca?.unitId ?? null,
        },
      })),
      nextCursor,
      {
        tenantId: scope.tenantId,
        ...(scope.units ? { unitIds: scope.units } : {}),
      },
    );
  }

  /** Cursor of the page's last row with its stored due date at full (microsecond) precision. */
  private async cursorAfter(last: RcaAction): Promise<string> {
    if (!last.dueDate)
      return CursorCodec.encode({ sortValue: null, id: last.id });
    const rows: Array<{ value: string }> = await this.dataSource.query(
      `SELECT "due_date"::text AS "value" FROM "rca_actions" WHERE "id" = $1 AND "tenant_id" = $2`,
      [last.id, last.tenantId],
    );
    return CursorCodec.encode({
      sortValue: rows[0]?.value ?? last.dueDate.toISOString(),
      id: last.id,
    });
  }
}
