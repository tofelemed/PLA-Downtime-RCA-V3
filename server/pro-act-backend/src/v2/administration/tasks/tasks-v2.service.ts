import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { scopedQuery } from '../../../common/query/scoped-query';
import { Task } from '../../../task/task.entity';
import { keysetPage } from '../../common/keyset-page';
import { listResponse, ListResponse } from '../../common/response';
import { parseSort } from '../../common/sort-spec';
import { expressionKeysetPage } from '../common/expression-keyset';
import {
  escapeLike,
  UserDirectoryService,
} from '../users/user-directory.service';
import { TaskFiltersDto, TasksListQueryDto } from './tasks-v2.dto';
import { TaskSummaryView, TaskV2View, toTaskView } from './task-v2.view';

type TaskSortField = 'dueDate' | 'createdAt';
const SORT_FIELDS = [
  'dueDate',
  'createdAt',
] as const satisfies readonly TaskSortField[];
const DUE_KEY = `date_trunc('milliseconds', COALESCE("t"."due_date", 'infinity'::timestamptz))`;
const OPEN_DUE = `"t"."due_date" < :now AND "t"."status" NOT IN ('Completed', 'Cancelled')`;

interface SummaryRow {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
}

/** Reads of the plant's tasks (replaces v1 `GET /tasks`, which listed every row unpaged). */
@Injectable()
export class TasksV2Service {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    private readonly directory: UserDirectoryService,
  ) {}

  async list(
    context: RequestContext,
    query: TasksListQueryDto,
  ): Promise<ListResponse<TaskV2View>> {
    const tenantId = requireTenantId(context);
    const now = new Date();
    const qb = this.filtered(context, query);
    if (query.statuses?.length) {
      qb.andWhere('t.status IN (:...statuses)', { statuses: query.statuses });
    }
    if (query.overdue) qb.andWhere(OPEN_DUE, { now });
    const page = await this.page(qb, query);
    const items = await this.toViews(tenantId, page.items, now);
    return listResponse(items, page.nextCursor, { tenantId });
  }

  async get(context: RequestContext, id: string): Promise<TaskV2View> {
    const task = await this.find(context, id);
    const [view] = await this.toViews(
      requireTenantId(context),
      [task],
      new Date(),
    );
    return view;
  }

  async summary(
    context: RequestContext,
    query: TaskFiltersDto,
  ): Promise<TaskSummaryView> {
    const now = new Date();
    const row = await this.filtered(context, query)
      .select('COUNT(*)::int', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE "t"."status" = 'Open')::int`, 'open')
      .addSelect(
        `COUNT(*) FILTER (WHERE "t"."status" = 'In Progress')::int`,
        'inProgress',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE "t"."status" = 'Completed')::int`,
        'completed',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE "t"."status" = 'Cancelled')::int`,
        'cancelled',
      )
      .addSelect(`COUNT(*) FILTER (WHERE ${OPEN_DUE})::int`, 'overdue')
      .setParameter('now', now)
      .getRawOne<SummaryRow>();
    const counts = row ?? {
      total: 0,
      open: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      overdue: 0,
    };
    return { ...counts, asOf: now.toISOString() };
  }

  /** The task in the acting plant, or 404 (a task of another plant is never found). */
  async find(context: RequestContext, id: string): Promise<Task> {
    const task = await scopedQuery(this.tasks, 't', { context })
      .andWhere('t.id = :id', { id })
      .getOne();
    if (!task)
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    return task;
  }

  async toViews(
    tenantId: string,
    rows: Task[],
    now: Date,
  ): Promise<TaskV2View[]> {
    const names = await this.directory.nameMap(
      tenantId,
      rows.flatMap((row) => [row.assignedTo, row.assignedBy]),
    );
    return rows.map((row) => toTaskView(row, names, now));
  }

  /** Filters of the list and the summary; `from` / `to` bound the due date (half-open). */
  private filtered(
    context: RequestContext,
    query: TaskFiltersDto,
  ): SelectQueryBuilder<Task> {
    const qb = scopedQuery(this.tasks, 't', { context });
    if (query.priorities?.length) {
      qb.andWhere('t.priority IN (:...priorities)', {
        priorities: query.priorities,
      });
    }
    const assignee = query.assignedToMe ? context.userId : query.assigneeId;
    if (assignee) qb.andWhere('t.assignedTo = :assignee', { assignee });
    if (query.linkType)
      qb.andWhere('t.entityType = :linkType', { linkType: query.linkType });
    if (query.linkId)
      qb.andWhere('t.entityId = :linkId', { linkId: query.linkId });
    if (query.q) {
      qb.andWhere('(t.title ILIKE :q OR t.description ILIKE :q)', {
        q: `%${escapeLike(query.q)}%`,
      });
    }
    if (query.from) qb.andWhere('t.dueDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('t.dueDate < :to', { to: query.to });
    return qb;
  }

  private page(qb: SelectQueryBuilder<Task>, query: TasksListQueryDto) {
    const sort = parseSort<TaskSortField>(query.sort, SORT_FIELDS, {
      field: 'dueDate',
      direction: 'ASC',
    });
    if (sort.field === 'createdAt') {
      return keysetPage(qb, {
        alias: 't',
        property: 'createdAt',
        direction: sort.direction,
        cursor: query.cursor,
        limit: query.limit,
      });
    }
    return expressionKeysetPage(qb, {
      alias: 't',
      expression: DUE_KEY,
      cast: 'timestamptz',
      direction: sort.direction,
      cursor: query.cursor,
      limit: query.limit,
      valueOf: (task) =>
        task.dueDate ? new Date(task.dueDate).toISOString() : 'infinity',
    });
  }
}
