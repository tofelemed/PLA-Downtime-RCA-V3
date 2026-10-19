import { EntityManager, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { legacyRolesOf } from '../../auth/roles/legacy-roles-of';
import { Unit } from '../../unit/unit.entity';
import { User } from '../../users/user.entity';
import {
  APPROVAL_TARGET_FACTS,
  ApprovalDefinition,
  ApprovalTargetFact,
} from './approval-catalog';
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
  requesterId: string | null;
  href: string;
  commandId: string;
  version: number | null;
  rowVersion: number;
  targetPeriodId: string | null;
  targetPlanId: string | null;
  targetRevision: number | null;
  targetMonthKey: string | null;
  targetEventId: string | null;
  targetProfileId: string | null;
}
const targetAlias = (fact: ApprovalTargetFact) =>
  `target${fact.charAt(0).toUpperCase()}${fact.slice(1)}`;
const TARGET_CAST: Readonly<Record<ApprovalTargetFact, string>> = {
  periodId: 'text',
  planId: 'text',
  revision: 'int',
  monthKey: 'text',
  eventId: 'text',
  profileId: 'text',
};
type InboxQuery = SelectQueryBuilder<ObjectLiteral>;
/** Whom the decision must be independent of: the requester rule of the step, else the record's author. */
const requesterOf = (definition: ApprovalDefinition) =>
  definition.requester ?? definition.author ?? 'r.createdBy';
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
    `${requesterOf(definition)} AS "requesterId"`,
    `${definition.href} AS "href"`,
    `${definition.commandId ?? 'r.id'} AS "commandId"`,
    `${definition.version ?? (definition.actions?.length ? 'r.version' : 'NULL::int')} AS "version"`,
    'r.rowVersion AS "rowVersion"',
    ...APPROVAL_TARGET_FACTS.map(
      (fact) =>
        `(${definition.target?.[fact] ?? 'NULL'})::${TARGET_CAST[fact]} AS "${targetAlias(fact)}"`,
    ),
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
    ...legacyRolesOf(context),
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
/** Mirrors `decision`: a requester's own record stays only where a decision is still open to them. */
function decidableOnly(
  qb: InboxQuery,
  context: RequestContext,
  definition: ApprovalDefinition,
): void {
  if (context.isSuperAdmin || definition.ownMayDecide) return;
  if (definition.actions?.includes('retire')) return;
  qb.andWhere(
    `(${requesterOf(definition)}) IS DISTINCT FROM :inboxUserId::uuid`,
    { inboxUserId: context.userId },
  );
}
export async function queryInboxRows(
  manager: EntityManager,
  context: RequestContext,
  definition: ApprovalDefinition,
  page: {
    query: Pick<ApprovalInboxQueryDto, 'limit' | 'decidable'>;
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
  if (page.query.decidable === 'true') decidableOnly(qb, context, definition);
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
const OWN_REQUEST = 'A different approver must decide your own request.';
function decision(
  definition: ApprovalDefinition,
  own: boolean,
  actions: ApprovalItemView['actions'],
): Pick<ApprovalItemView, 'canDecide' | 'decisionBlockedReason'> {
  if (actions.length > 0) {
    const open = actions.some((action) => !action.disabledReason);
    return {
      canDecide: open,
      decisionBlockedReason: open ? null : (actions[0].disabledReason ?? null),
    };
  }
  const blocked = own && !definition.ownMayDecide;
  return {
    canDecide: !blocked,
    decisionBlockedReason: blocked
      ? (definition.ownReason ?? OWN_REQUEST)
      : null,
  };
}
export function toApprovalItem(
  context: RequestContext,
  definition: ApprovalDefinition,
  row: InboxRow,
): ApprovalItemView {
  const own = !context.isSuperAdmin && row.requesterId === context.userId;
  const actions = (definition.actions ?? []).map((action) => ({
    action,
    disabledReason: own && action !== 'retire' ? OWN_REQUEST : null,
  }));
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
    actions,
    ...decision(definition, own, actions),
    headline: null,
    target: {
      periodId: row.targetPeriodId,
      planId: row.targetPlanId,
      revision: row.targetRevision,
      monthKey: row.targetMonthKey,
      eventId: row.targetEventId,
      profileId: row.targetProfileId,
    },
  };
}
