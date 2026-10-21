import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLog } from '../../../audit-log/audit-log.entity';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { scopedQuery } from '../../../common/query/scoped-query';
import { plantTimezone } from '../../activity-summary/plant-timezone';
import { keysetPage } from '../../common/keyset-page';
import { listResponse, ListResponse } from '../../common/response';
import { parseSort } from '../../common/sort-spec';
import {
  escapeLike,
  UserDirectoryService,
} from '../users/user-directory.service';
import { AuditFiltersDto, AuditListQueryDto } from './audit-logs-v2.dto';
import {
  AuditCount,
  AuditDayCount,
  AuditEntryV2View,
  AuditSummaryView,
  toAuditEntryView,
} from './audit-entry-v2.view';

/** Most rows one CSV export carries; the response says when it was cut (`X-Export-Truncated`). */
export const AUDIT_EXPORT_MAX_ROWS = 10_000;
const TOP_KEYS = 50;

interface RawCount {
  key: string;
  count: number;
}

/**
 * The acting plant's audit trail on v2 (replaces `GET /reports/audit-trail`, capped at 500 rows, and the
 * client-side filtering of the v1 Audit Logs page): keyset pages, server filters and search, counts and
 * a bounded CSV export. Readers: `AUDIT_READERS`.
 */
@Injectable()
export class AuditLogsV2Service {
  constructor(
    @InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>,
    private readonly directory: UserDirectoryService,
  ) {}

  async list(
    context: RequestContext,
    query: AuditListQueryDto,
  ): Promise<ListResponse<AuditEntryV2View>> {
    const tenantId = requireTenantId(context);
    const sort = parseSort(query.sort, ['timestamp'] as const, {
      field: 'timestamp',
      direction: 'DESC',
    });
    const page = await keysetPage(this.filtered(context, query), {
      alias: 'log',
      property: 'timestamp',
      direction: sort.direction,
      cursor: query.cursor,
      limit: query.limit,
    });
    const items = await this.toViews(tenantId, page.items);
    return listResponse(items, page.nextCursor, { tenantId });
  }

  async get(context: RequestContext, id: string): Promise<AuditEntryV2View> {
    const entry = await scopedQuery(this.logs, 'log', { context })
      .andWhere('log.id = :id', { id })
      .getOne();
    if (!entry)
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    const [view] = await this.toViews(requireTenantId(context), [entry]);
    return view;
  }

  async summary(
    context: RequestContext,
    query: AuditFiltersDto,
  ): Promise<AuditSummaryView> {
    const counted = (column: string) =>
      this.filtered(context, query)
        .select(column, 'key')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('key')
        .orderBy('count', 'DESC')
        .limit(TOP_KEYS)
        .getRawMany<RawCount>();
    const timezone = await this.plantTimezone(requireTenantId(context));
    const [total, byAction, byEntityType, byDay] = await Promise.all([
      this.filtered(context, query).getCount(),
      counted('log.action'),
      counted('log.entityType'),
      this.filtered(context, query)
        .select(
          `to_char(log.timestamp AT TIME ZONE :timezone, 'YYYY-MM-DD')`,
          'day',
        )
        .addSelect('COUNT(*)::int', 'count')
        .setParameter('timezone', timezone)
        .groupBy('day')
        .orderBy('day', 'ASC')
        .getRawMany<AuditDayCount>(),
    ]);
    const asCounts = (rows: RawCount[]): AuditCount[] =>
      rows.map((row) => ({ key: row.key, count: row.count }));
    return {
      total,
      byAction: asCounts(byAction),
      byEntityType: asCounts(byEntityType),
      byDay,
      asOf: new Date().toISOString(),
    };
  }

  /** Newest first, at most `AUDIT_EXPORT_MAX_ROWS`; `truncated` when more matched. */
  async exportRows(
    context: RequestContext,
    query: AuditFiltersDto,
  ): Promise<{
    rows: AuditEntryV2View[];
    truncated: boolean;
    timezone: string;
  }> {
    const rows = await this.filtered(context, query)
      .orderBy('log.timestamp', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .limit(AUDIT_EXPORT_MAX_ROWS + 1)
      .getMany();
    const kept = rows.slice(0, AUDIT_EXPORT_MAX_ROWS);
    return {
      rows: await this.toViews(requireTenantId(context), kept),
      truncated: rows.length > AUDIT_EXPORT_MAX_ROWS,
      timezone: await this.plantTimezone(requireTenantId(context)),
    };
  }

  /** Days are plant-local: the default site's timezone, else the tenant's, else UTC (like the work summary). */
  private plantTimezone(tenantId: string): Promise<string> {
    return plantTimezone(this.logs.manager, tenantId);
  }

  private filtered(
    context: RequestContext,
    query: AuditFiltersDto,
  ): SelectQueryBuilder<AuditLog> {
    if (
      query.from &&
      query.to &&
      !(new Date(query.from) < new Date(query.to))
    ) {
      throw new UnprocessableEntityException({
        code: 'INVALID_RANGE',
        message: 'from must be before to',
      });
    }
    const qb = scopedQuery(this.logs, 'log', { context });
    if (query.from)
      qb.andWhere('log.timestamp >= :from', { from: new Date(query.from) });
    if (query.to)
      qb.andWhere('log.timestamp < :to', { to: new Date(query.to) });
    if (query.actions?.length)
      qb.andWhere('log.action IN (:...actions)', { actions: query.actions });
    if (query.entityTypes?.length) {
      qb.andWhere('log.entityType IN (:...entityTypes)', {
        entityTypes: query.entityTypes,
      });
    }
    if (query.userIds?.length)
      qb.andWhere('log.userId IN (:...userIds)', { userIds: query.userIds });
    if (query.entityId)
      qb.andWhere('log.entityId = :entityId', { entityId: query.entityId });
    if (query.q) {
      qb.andWhere(
        '(log.action ILIKE :q OR log.entityType ILIKE :q OR log.details ILIKE :q)',
        {
          q: `%${escapeLike(query.q)}%`,
        },
      );
    }
    return qb;
  }

  private async toViews(
    tenantId: string,
    rows: AuditLog[],
  ): Promise<AuditEntryV2View[]> {
    const names = await this.directory.nameMap(
      tenantId,
      rows.map((row) => row.userId),
    );
    return rows.map((row) => toAuditEntryView(row, names));
  }
}
