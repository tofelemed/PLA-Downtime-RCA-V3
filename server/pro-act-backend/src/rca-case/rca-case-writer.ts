import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { RCA } from '../rca/rca.entity';
import {
  RcaCaseV2CreateDto,
  RcaCaseV2UpdateDto,
  RcaRecommendationItemDto,
} from '../v2/rca/rca-cases-v2.dto';
import { attributeEvidence, evidenceAssignees } from './evidence-attribution';
import { caseAudit, recordRcaAudit } from './rca-audit';
import { writeDiagram } from './rca-case-diagram';
import { writeJson } from './rca-case-json';
import { templateLogicTree } from './rca-case-template';
import { START_STATUSES, withInvestigators } from '../domain/rca/case-workflow';
import {
  assertCaseUnit,
  invalidBody,
  invalidReference,
  RcaScope,
} from './rca-scope';

const date = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

/**
 * Item 5: every recommendation keeps a stable id (actions point at it): items sent without one get a
 * server id, ids the client sends back (including the `rec-N` read of an id-less v1 item) are kept. The
 * read-only `actions` list of the view is never stored.
 */
function withRecommendationIds(
  items: readonly RcaRecommendationItemDto[] | undefined,
): RcaRecommendationItemDto[] | undefined {
  return items?.map((item) => {
    const stored = { ...item, id: item.id || randomUUID() };
    delete stored.actions;
    return stored;
  });
}

/**
 * Columns of `rcas` a body sets (undefined = untouched; JSON text for the nested content). The status is
 * never copied from a body (RCA-01): it moves only through the state machine.
 */
export function caseColumns(body: RcaCaseV2UpdateDto): Partial<RCA> {
  const columns: Record<string, unknown> = {
    title: body.title,
    description: body.description,
    priority: body.priority,
    consequenceClass: body.consequenceClass,
    unitId: body.unitId,
    assetId: body.assetId,
    teamLeadId: body.teamLeadId,
    teamMemberIds: writeJson(body.teamMemberIds),
    targetCloseDate: date(body.targetCloseDate),
    actualCloseDate: date(body.actualCloseDate),
    rootCause: body.rootCause,
    templateId: body.templateId,
    recommendations: writeJson(withRecommendationIds(body.recommendations)),
    evidence: writeJson(body.evidence),
    logicTree: writeJson(body.logicTree),
    teamCharter: body.teamCharter,
    eventDiagram: writeDiagram(body.eventDiagram),
  };
  return Object.fromEntries(
    Object.entries(columns).filter(([, value]) => value !== undefined),
  );
}

async function exists(
  manager: EntityManager,
  sql: string,
  params: unknown[],
): Promise<boolean> {
  const rows: unknown[] = await manager.query(sql, params);
  return rows.length > 0;
}

async function assertUsers(
  manager: EntityManager,
  scope: RcaScope,
  ids: string[],
  field: string,
): Promise<void> {
  if (ids.length === 0) return;
  const rows: Array<{ id: string }> = await manager.query(
    `SELECT u."id" FROM "users" u WHERE u."id" = ANY($1::uuid[]) AND (u."tenant_id" = $2
        OR EXISTS (SELECT 1 FROM "user_scopes" s WHERE s."user_id" = u."id" AND s."tenant_id" = $2))`,
    [ids, scope.tenantId],
  );
  if (rows.length !== new Set(ids).size) throw invalidReference(field);
}

/**
 * Body references must be of the caller's tenant and units (422 INVALID_REFERENCE): the unit (a
 * tenant-wide case needs a tenant-wide grant), the asset (of the case unit when there is one), team
 * members and the template.
 */
export async function assertCaseReferences(
  manager: EntityManager,
  scope: RcaScope,
  body: RcaCaseV2UpdateDto,
  unitId: string | null,
): Promise<void> {
  await assertCaseUnit(manager, scope, unitId);
  if (body.assetId) {
    const ok = await exists(
      manager,
      `SELECT 1 FROM "assets" WHERE "id" = $1 AND "tenant_id" = $2 AND ($3::text IS NULL OR "unit_id" = $3::text)`,
      [body.assetId, scope.tenantId, unitId],
    );
    if (!ok) throw invalidReference('assetId');
  }
  if (body.teamLeadId)
    await assertUsers(manager, scope, [body.teamLeadId], 'teamLeadId');
  await assertUsers(manager, scope, body.teamMemberIds ?? [], 'teamMemberIds');
  await assertUsers(
    manager,
    scope,
    evidenceAssignees(body.evidence),
    'evidence.taskAssigneeId',
  );
  if (body.templateId) {
    const ok = await exists(
      manager,
      `SELECT 1 FROM "rca_templates" WHERE "id" = $1 AND "tenant_id" = $2`,
      [body.templateId, scope.tenantId],
    );
    if (!ok) throw invalidReference('templateId');
  }
}

/**
 * Inserts a validated case of the caller's tenant (Draft / Medium unless the body says otherwise). A case
 * opened from a template without its own logic tree starts with a copy of the template's tree.
 */
export async function insertCase(
  manager: EntityManager,
  scope: RcaScope,
  body: RcaCaseV2CreateDto,
): Promise<RCA> {
  const unitId = body.unitId ?? null;
  await assertCaseReferences(manager, scope, body, unitId);
  const repository = manager.getRepository(RCA);
  const fromTemplate =
    body.templateId && !body.logicTree?.length
      ? await templateLogicTree(manager, scope.tenantId, body.templateId)
      : null;
  const status = body.status ?? 'Draft';
  if (!START_STATUSES.includes(status)) {
    throw invalidBody(
      'INVALID_STATUS',
      'status',
      `a case opens as ${START_STATUSES.join(' or ')}; later statuses are reached through transitions`,
    );
  }
  const evidence = body.evidence
    ? attributeEvidence([], body.evidence, {
        userId: scope.userId,
        now: new Date(),
      })
    : undefined;
  const entity = repository.create({
    ...caseColumns({
      ...body,
      evidence,
      ...(fromTemplate ? { logicTree: fromTemplate } : {}),
    }),
    id: randomUUID(),
    status,
    priority: body.priority ?? 'Medium',
    unitId,
    tenantId: scope.tenantId,
    createdBy: scope.userId,
    investigatorIds: withInvestigators(
      [],
      [scope.userId, body.teamLeadId, ...(body.teamMemberIds ?? [])],
    ),
  });
  const saved = await repository.save(entity);
  await recordRcaAudit(manager, scope, [
    caseAudit('created', { before: null, after: saved }),
  ]);
  return saved;
}
