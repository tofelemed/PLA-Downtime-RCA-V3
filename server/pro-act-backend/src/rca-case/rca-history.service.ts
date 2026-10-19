import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditEntry } from '../common/audit/audit-entry.entity';
import { RequestContext } from '../common/context/request-context';
import { keysetPage } from '../v2/common/keyset-page';
import { RcaHistoryV2QueryDto } from '../v2/rca/rca-history-v2.dto';
import { listResponse, ListResponse } from '../v2/common/response';
import { RCA_AUDIT_ENTITIES } from './rca-audit';
import { findCase, scopeOf } from './rca-scope';
import { historyReason } from './repair-reasons';

/** One entry of a case's field history (`GET /v2/rcas/{id}/history`). */
export interface RcaHistoryEntryV2View {
  id: string;
  at: string;
  /** `<entityType>.<verb>`, e.g. `rca_case.closed`, `rca_action.updated` */
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  /** null when the user is not readable any more, or a service acted */
  actorName: string | null;
  service: string | null;
  reason: string | null;
  revision: number | null;
  changedFields: string[];
  /** before / after of small scalar fields (status, owner, due date, root-cause length, …) */
  values: Record<string, { from: unknown; to: unknown }>;
  beforeHash: string | null;
  afterHash: string | null;
  /** the remaining facts of the command (tool, file name, link target, …) */
  detail: Record<string, unknown>;
}

/** A page of the history with the number of entries of the case (QA L8: the pager names it on every page). */
export interface RcaHistoryPageV2View
  extends ListResponse<RcaHistoryEntryV2View> {
  totalCount: number;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const record = (
  value: unknown,
): Record<string, { from: unknown; to: unknown }> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, { from: unknown; to: unknown }>)
    : {};

function toEntry(
  row: AuditEntry,
  names: ReadonlyMap<string, string>,
): RcaHistoryEntryV2View {
  const { changedFields, values, ...rest } = row.detail;
  const detail = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key !== 'caseId'),
  );
  return {
    id: row.id,
    at: row.at.toISOString(),
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorId: row.actorId,
    actorName: row.actorId ? (names.get(row.actorId) ?? null) : null,
    service: row.service,
    reason: historyReason(row),
    revision: row.revision,
    changedFields: strings(changedFields),
    values: record(values),
    beforeHash: row.beforeHash,
    afterHash: row.afterHash,
    detail,
  };
}

/**
 * RCA field history (item 2): the append-only `audit_log` rows of a case and of its child rows (actions,
 * links, analyses, causes), newest first in keyset pages, with the actor's name. Readable by whoever may
 * read the case (404 outside the caller's tenant and units).
 */
@Injectable()
export class RcaHistoryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(
    context: RequestContext,
    rcaId: string,
    query: RcaHistoryV2QueryDto,
  ): Promise<RcaHistoryPageV2View> {
    const scope = scopeOf(context);
    await findCase(this.dataSource.manager, scope, rcaId);
    const qb = this.dataSource
      .getRepository(AuditEntry)
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId: scope.tenantId })
      .andWhere('a.entityType IN (:...types)', {
        types: [...RCA_AUDIT_ENTITIES],
      })
      .andWhere(`a.detail ->> 'caseId' = :rcaId`, { rcaId });
    const totalCount = await qb.clone().getCount();
    const page = await keysetPage(qb, {
      alias: 'a',
      property: 'at',
      direction: 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    const names = await this.actorNames(page.items);
    const list = listResponse(
      page.items.map((row) => toEntry(row, names)),
      page.nextCursor,
      {
        tenantId: scope.tenantId,
        ...(scope.units ? { unitIds: scope.units } : {}),
      },
    );
    return { ...list, totalCount };
  }

  private async actorNames(
    rows: readonly AuditEntry[],
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(rows.flatMap((row) => (row.actorId ? [row.actorId] : []))),
    ];
    if (ids.length === 0) return new Map();
    const users: Array<{ id: string; name: string | null }> =
      await this.dataSource.query(
        `SELECT "id", "name" FROM "users" WHERE "id" = ANY($1::uuid[])`,
        [ids],
      );
    return new Map(
      users.flatMap((user) => (user.name ? [[user.id, user.name]] : [])),
    );
  }
}
