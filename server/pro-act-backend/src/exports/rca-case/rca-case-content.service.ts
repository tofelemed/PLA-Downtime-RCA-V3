import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { RcaActionV2View } from '../../rca-case/rca-action.view';
import { RcaActionsService } from '../../rca-case/rca-actions.service';
import { RcaAnalysesService } from '../../rca-case/rca-analyses.service';
import { RcaCaseV2View } from '../../rca-case/rca-case.view';
import { RcaCasesService } from '../../rca-case/rca-cases.service';
import { RcaCausesService } from '../../rca-case/rca-causes.service';
import { RcaOutcomeV2View } from '../../rca-case/rca-outcome';
import {
  analysesSummary,
  RcaCaseExportContent,
  RcaCaseTimelineEntry,
} from './rca-case-content';

/** Status changes and the opening of a case, from its History (`audit_log`, at most 200, oldest first). */
const TIMELINE_SQL = `
  SELECT a."at", a."action", a."reason", u."name" AS "actor_name",
         a."detail" -> 'values' -> 'status' ->> 'from' AS "from_status",
         a."detail" -> 'values' -> 'status' ->> 'to' AS "to_status"
    FROM "audit_log" a LEFT JOIN "users" u ON u."id" = a."actor_id"
   WHERE a."tenant_id" = $1 AND a."entity_type" = 'rca_case' AND a."entity_id" = $2
     AND (a."action" = 'rca_case.created' OR a."detail" -> 'values' ? 'status')
   ORDER BY a."at", a."id" LIMIT 200`;

interface TimelineRow {
  at: Date;
  action: string;
  reason: string | null;
  actor_name: string | null;
  from_status: string | null;
  to_status: string | null;
}

type Names = ReadonlyMap<string, string>;

const nameIn = (names: Names, id: string | null | undefined) =>
  id ? (names.get(id) ?? null) : null;

function caseOf(
  rca: RcaCaseV2View,
  names: Names,
  unitName: string | null,
): RcaCaseExportContent['case'] {
  return {
    id: rca.id,
    title: rca.title,
    status: rca.status,
    priority: rca.priority,
    unitName,
    description: rca.description,
    consequenceClass: rca.consequenceClass,
    createdAt: rca.createdAt,
    createdByName: nameIn(names, rca.createdBy),
    targetCloseDate: rca.targetCloseDate,
    actualCloseDate: rca.actualCloseDate,
    rootCause: rca.rootCause,
  };
}

function closureOf(
  rca: RcaCaseV2View,
  names: Names,
): RcaCaseExportContent['closure'] {
  return {
    residualRisk: rca.residualRisk,
    requestedByName: nameIn(names, rca.closureRequestedBy),
    requestedAt: rca.closureRequestedAt,
    approvedByName: nameIn(names, rca.closureApprovedBy),
    approvedAt: rca.closureApprovedAt,
    note: rca.closureNote,
    effectivenessVerdict: rca.effectivenessVerdict,
    selfDecided: rca.selfDecided,
  };
}

function actionsOf(
  actions: readonly RcaActionV2View[],
  names: Names,
): RcaCaseExportContent['actions'] {
  return actions.map((a) => ({
    title: a.title,
    ownerName: nameIn(names, a.ownerId),
    dueDate: a.dueDate,
    status: a.status,
    completedAt: a.completedAt,
    verificationStatus: a.verificationStatus,
    verdict: a.verdict,
    selfDecided: a.selfDecided,
  }));
}

function outcomeOf(outcome: RcaOutcomeV2View): RcaCaseExportContent['outcome'] {
  const approved = outcome.approvedHistoricalLoss;
  return {
    approved: {
      lines: approved.lines,
      basis: approved.basis,
      values: approved.values,
    },
    claimed: outcome.claimedAvoided,
    realized: outcome.realized.map((r) => ({
      title: r.title,
      metric: r.metric,
      expected: r.expected,
      observed: r.observed,
      difference: r.difference,
      verdict: r.verdict,
    })),
    note: outcome.note,
  };
}

const timelineEntry = (row: TimelineRow): RcaCaseTimelineEntry => ({
  at: new Date(row.at).toISOString(),
  action: row.action,
  fromStatus: row.from_status,
  toStatus: row.to_status,
  actorName: row.actor_name,
  reason: row.reason,
});

/**
 * Reads one RCA case for its `rca_case` export (item 2.5) through the case services, so the requester's
 * scope applies exactly as on the screens (404 outside the caller's tenant and units): the case, its team,
 * History status timeline, typed causes, analyses, actions with verification, the outcome's three separate
 * figures (approved valued in the view frozen when the periods were approved) and the closure approval.
 */
@Injectable()
export class RcaCaseContentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cases: RcaCasesService,
    private readonly causes: RcaCausesService,
    private readonly analyses: RcaAnalysesService,
    private readonly actions: RcaActionsService,
  ) {}

  /** The pinned content and the case's unit (null = a tenant-wide case). */
  async read(
    context: RequestContext,
    rcaId: string,
  ): Promise<{ content: RcaCaseExportContent; unitId: string | null }> {
    const rca = await this.cases.get(context, rcaId);
    const [causes, analyses, actions, outcome] = await Promise.all([
      this.causes.list(context, rcaId),
      this.analyses.list(context, rcaId),
      this.actions.list(context, rcaId),
      this.actions.outcome(context, rcaId),
    ]);
    const tenantId = requireTenantId(context);
    const names = await this.userNames(rca, actions);
    const content: RcaCaseExportContent = {
      case: caseOf(rca, names, await this.unitName(tenantId, rca.unitId)),
      team: {
        leadName: nameIn(names, rca.teamLeadId),
        memberNames: rca.teamMemberIds.map(
          (id) => names.get(id) ?? 'Unnamed user',
        ),
      },
      timeline: await this.timeline(tenantId, rcaId),
      causes: causes.map((c) => ({
        kind: c.kind,
        code: c.causeCode?.code ?? null,
        name: c.causeCode?.name ?? null,
        statement: c.statement,
      })),
      analyses: analysesSummary(analyses),
      actions: actionsOf(actions, names),
      outcome: outcomeOf(outcome),
      closure: closureOf(rca, names),
    };
    return { content, unitId: rca.unitId };
  }

  private async userNames(
    rca: RcaCaseV2View,
    actions: readonly RcaActionV2View[],
  ): Promise<Map<string, string>> {
    const ids = [
      rca.createdBy,
      rca.teamLeadId,
      ...rca.teamMemberIds,
      rca.closureRequestedBy,
      rca.closureApprovedBy,
      ...actions.map((a) => a.ownerId),
    ].filter((id): id is string => Boolean(id));
    if (ids.length === 0) return new Map();
    const rows: Array<{ id: string; name: string | null }> =
      await this.dataSource.query(
        `SELECT "id"::text AS "id", "name" FROM "users" WHERE "id" = ANY($1::uuid[])`,
        [[...new Set(ids)]],
      );
    return new Map(rows.flatMap((r) => (r.name ? [[r.id, r.name]] : [])));
  }

  private async unitName(
    tenantId: string,
    unitId: string | null,
  ): Promise<string | null> {
    if (!unitId) return null;
    const rows: Array<{ name: string }> = await this.dataSource.query(
      `SELECT "name" FROM "units" WHERE "id" = $1 AND "tenant_id" = $2`,
      [unitId, tenantId],
    );
    return rows[0]?.name ?? null;
  }

  private async timeline(
    tenantId: string,
    rcaId: string,
  ): Promise<RcaCaseTimelineEntry[]> {
    const rows: TimelineRow[] = await this.dataSource.query(TIMELINE_SQL, [
      tenantId,
      rcaId,
    ]);
    return rows.map(timelineEntry);
  }
}
