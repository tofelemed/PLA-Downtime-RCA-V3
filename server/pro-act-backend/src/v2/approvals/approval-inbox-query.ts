import { EntityManager, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { rolesForLegacyRole } from '../../auth/roles/role-model';
import { Unit } from '../../unit/unit.entity';
import { User } from '../../users/user.entity';
import { ApprovalDefinition } from './approval-catalog';
import { ApprovalCursor } from './approval-cursor';
import {
  ApprovalInboxQueryDto,
  ApprovalItemView,
} from './approval-inbox-v2.dto';
import { approvalScope } from './approval-scope';

interface InboxRow {
  id: string;
  title: string;
  summary: string | null;
  state: string;
  at: string;
  unitId: string | null;
  unitName: string | null;
  authorId: string | null;
  authorName: string | null;
  href: string;
  commandId: string;
  version: number | null;
  rowVersion: number;
}
type InboxQuery = SelectQueryBuilder<ObjectLiteral>;
function selectRow(qb: InboxQuery, definition: ApprovalDefinition): void {
  const author = definition.author ?? 'r.createdBy';
  qb.leftJoin(
    Unit,
    'u',
    `u.id = ${definition.unit ?? 'NULL::uuid'} AND u.tenantId = r.tenantId`,
  );
  qb.leftJoin(User, 'a', `a.id = ${author} AND a.tenantId = r.tenantId`);
  qb.select([
    'r.id AS "id"',
    `${definition.title} AS "title"`,
    `left(coalesce((${definition.summary})::text, ''), 2000) AS "summary"`,
    `${definition.state ?? 'r.state'} AS "state"`,
    `to_char(r.createdAt AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "at"`,
    `${definition.unit ?? 'NULL::uuid'} AS "unitId"`,
    'u.name AS "unitName"',
    `${author} AS "authorId"`,
    'a.name AS "authorName"',
    `${definition.href} AS "href"`,
    `${definition.commandId ?? 'r.id'} AS "commandId"`,
    `${definition.version ?? (definition.actions?.length ? 'r.version' : 'NULL::int')} AS "version"`,
    'r.rowVersion AS "rowVersion"',
  ]);
}
function workflowScope(
  qb: InboxQuery,
  context: RequestContext,
  definition: ApprovalDefinition,
): void {
  if (
    definition.kind !== 'month-materiality' ||
    context.isSuperAdmin ||
    context.roles.includes('OrgAdmin')
  )
    return;
  const roles = [
    ...rolesForLegacyRole(context.legacyRole),
    ...context.scopes
      .filter(
        (scope) =>
          scope.tenantId === context.tenantId && scope.kind === 'tenant',
      )
      .map((scope) => scope.role),
  ];
  qb.andWhere(
    `(pol.body->'materiality'->'reviewerRoles') ?| ARRAY[:...materialityRoles]::text[]`,
    { materialityRoles: roles.length ? roles : ['__none__'] },
  );
}
export async function queryInboxRows(
  manager: EntityManager,
  context: RequestContext,
  definition: ApprovalDefinition,
  page: {
    query: Pick<ApprovalInboxQueryDto, 'limit'>;
    cursor: ApprovalCursor | null;
    /** one pending record (the approval detail), still under the caller's role and scope */
    recordId?: string;
  },
): Promise<InboxRow[]> {
  const scope = approvalScope(context, definition.roles, definition.unit);
  if (scope.sql === 'FALSE') return [];
  if (
    definition.kind === 'rca-closure' &&
    !context.isSuperAdmin &&
    !context.roles.includes('manager_approver')
  )
    return [];
  const qb = scopedQuery(manager.getRepository(definition.entity), 'r', {
    context,
  }).andWhere(definition.pending);
  for (const join of definition.joins ?? [])
    qb.leftJoin(
      manager.connection.getMetadata(join.entity).tablePath,
      join.alias,
      join.on,
    );
  qb.andWhere(scope.sql, scope.parameters);
  if (definition.secondUnit)
    qb.andWhere(
      approvalScope(context, definition.roles, definition.secondUnit).sql,
      scope.parameters,
    );
  workflowScope(qb, context, definition);
  if (page.recordId)
    qb.andWhere('r.id = :recordId', { recordId: page.recordId });
  selectRow(qb, definition);
  if (page.cursor)
    qb.andWhere(
      '(r.createdAt, r.id, :kind) > (:at::timestamptz, :id::uuid, :cursorKind)',
      {
        kind: definition.kind,
        at: page.cursor.at,
        id: page.cursor.id,
        cursorKind: page.cursor.kind,
      },
    );
  return qb
    .orderBy('r.createdAt', 'ASC')
    .addOrderBy('r.id', 'ASC')
    .limit(page.query.limit + 1)
    .getRawMany<InboxRow>();
}
export function toApprovalItem(
  context: RequestContext,
  definition: ApprovalDefinition,
  row: InboxRow,
): ApprovalItemView {
  const own = !context.isSuperAdmin && row.authorId === context.userId;
  return {
    id: row.id,
    kind: definition.kind,
    kindLabel: definition.label,
    title: row.title,
    summary: row.summary ?? '',
    state: row.state,
    createdAt: row.at,
    unitId: row.unitId,
    unitName: row.unitName,
    authorId: row.authorId,
    authorName: row.authorName,
    requiredRoles: [...definition.roles],
    reviewHref: row.href,
    resource: definition.resource ?? null,
    commandId: row.commandId,
    version: row.version,
    rowVersion: row.rowVersion,
    supersede: definition.supersede === true,
    actions: (definition.actions ?? []).map((action) => ({
      action,
      disabledReason:
        own && action !== 'retire'
          ? 'A different approver must decide your own request.'
          : null,
    })),
  };
}
