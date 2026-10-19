import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { ProductionEvent } from '../production-event/production-event.entity';
import { actorFromContext } from '../production-event/revisions/revision-actor';
import { RcaCaseLink, RcaLinkType } from '../rca/entities/rca-case-link.entity';
import { RCA } from '../rca/rca.entity';
import {
  EventRcaLinkV2Dto,
  RcaLinkV2CreateDto,
} from '../v2/rca/rca-links-v2.dto';
import { eventEvidencePackage, EventEvidencePackage } from './evidence-package';
import { moveEventRcaState } from './event-rca-pointer';
import { findEvent, resolveTarget, ResolvedTarget } from './link-targets';
import { recordRcaAudit } from './rca-audit';
import { insertCase } from './rca-case-writer';
import { RcaCaseSummaryV2View, toRcaCaseSummary } from './rca-case.view';
import { findCase, invalidBody, RcaScope, scopeOf } from './rca-scope';
import { assertCaseNotClosed } from './case-closed';
import { publicEvidence } from './evidence-basis-text';

export interface RcaLinkV2View {
  id: string;
  rcaId: string;
  linkType: RcaLinkType;
  targetId: string;
  targetRevision: number | null;
  unitId: string | null;
  source: string;
  linkedBy: string | null;
  linkedAt: string;
  reason: string | null;
  evidence: Record<string, unknown> | null;
}

export interface RcaLinkResultV2View {
  link: RcaLinkV2View;
  /** false when the target was already linked to the case (idempotent, 200) */
  created: boolean;
  caseCreated: boolean;
  rca: RcaCaseSummaryV2View;
}

export const toLinkView = (link: RcaCaseLink): RcaLinkV2View => ({
  id: link.id,
  rcaId: link.rcaId,
  linkType: link.linkType,
  targetId: link.targetId,
  targetRevision: link.targetRevision,
  unitId: link.unitId,
  source: link.source,
  linkedBy: link.linkedBy,
  linkedAt: link.linkedAt.toISOString(),
  reason: link.reason,
  evidence: publicEvidence(link.evidence),
});

/**
 * 409 CASE_CLOSED (Marun regression G4): a closed investigation takes no new link — its findings, impact and
 * closure verdict were approved on the links it had. Reopening it (independent approver) allows linking.
 */
const assertCaseOpen = (rca: RCA): void =>
  assertCaseNotClosed(
    rca,
    'The investigation is closed; reopen it to add a link',
  );

interface LinkInput {
  rca: RCA;
  linkType: RcaLinkType;
  targetId: string;
  target: ResolvedTarget;
  reason: string | null;
}

/**
 * RCA02 links (plan 3.9 step 3): an event, loss line, work order or occurrence joins a case once
 * (`UNIQUE (rca, type, target)`; a repeat is 200 with the existing link). Each new link snapshots its
 * evidence package; linking an event moves its RCA state to `linked` and accepts its open
 * recommendations. Automation never links on its own unless the policy says `create`.
 */
@Injectable()
export class RcaLinksService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async linkEvent(
    context: RequestContext,
    eventId: string,
    body: EventRcaLinkV2Dto,
  ): Promise<RcaLinkResultV2View> {
    if (Boolean(body.rcaId) === Boolean(body.create)) {
      throw invalidBody(
        'VALIDATION_FAILED',
        'rcaId',
        'give exactly one of rcaId or create',
      );
    }
    const scope = scopeOf(context);
    return this.dataSource.transaction(async (manager) => {
      const event = await findEvent(manager, scope, eventId);
      const rca = body.create
        ? await insertCase(manager, scope, {
            ...body.create,
            unitId:
              body.create.unitId === undefined
                ? event.unitId
                : body.create.unitId,
            assetId:
              body.create.assetId === undefined
                ? (event.assetId ?? null)
                : body.create.assetId,
          })
        : await this.caseFromBody(manager, scope, body.rcaId as string);
      const result = await this.linkEventIn(manager, context, {
        rca,
        event,
        reason: body.reason ?? null,
      });
      return { ...result, caseCreated: Boolean(body.create) };
    });
  }

  async link(
    context: RequestContext,
    rcaId: string,
    body: RcaLinkV2CreateDto,
  ): Promise<RcaLinkResultV2View> {
    const scope = scopeOf(context);
    return this.dataSource.transaction(async (manager) => {
      const rca = await findCase(manager, scope, rcaId, true);
      if (body.linkType === 'event') {
        const event = await findEvent(manager, scope, body.targetId, 'body');
        const result = await this.linkEventIn(manager, context, {
          rca,
          event,
          reason: body.reason ?? null,
        });
        return { ...result, caseCreated: false };
      }
      const existing = await this.existing(
        manager,
        rca.id,
        body.linkType,
        body.targetId,
      );
      if (existing)
        return { ...this.result(rca, existing, false), caseCreated: false };
      assertCaseOpen(rca);
      const target = await resolveTarget(manager, scope, {
        linkType: body.linkType,
        targetId: body.targetId,
      });
      const link = await this.insert(manager, context, {
        rca,
        linkType: body.linkType,
        targetId: body.targetId,
        target,
        reason: body.reason ?? null,
      });
      return { ...this.result(rca, link, true), caseCreated: false };
    });
  }

  async list(context: RequestContext, rcaId: string): Promise<RcaLinkV2View[]> {
    const scope = scopeOf(context);
    await findCase(this.dataSource.manager, scope, rcaId);
    const qb = this.dataSource
      .getRepository(RcaCaseLink)
      .createQueryBuilder('link')
      .where('link.tenantId = :tenantId AND link.rcaId = :rcaId', {
        tenantId: scope.tenantId,
        rcaId,
      });
    if (scope.units)
      qb.andWhere(
        '(link.unitId IS NULL OR link.unitId = ANY(:units::uuid[]))',
        { units: scope.units },
      );
    const links = await qb
      .orderBy('link.linkedAt', 'ASC')
      .addOrderBy('link.id', 'ASC')
      .limit(500)
      .getMany();
    return links.map(toLinkView);
  }

  /** Evidence package of an event as it would be stored now (preview in the link dialog; nothing stored). */
  async preview(
    context: RequestContext,
    eventId: string,
  ): Promise<EventEvidencePackage> {
    const scope = scopeOf(context);
    const event = await findEvent(this.dataSource.manager, scope, eventId);
    return eventEvidencePackage(this.dataSource.manager, scope.tenantId, event);
  }

  private async caseFromBody(
    manager: EntityManager,
    scope: RcaScope,
    id: string,
  ): Promise<RCA> {
    try {
      return await findCase(manager, scope, id, true);
    } catch {
      throw invalidBody(
        'INVALID_REFERENCE',
        'rcaId',
        'rcaId does not refer to a case of your scope',
      );
    }
  }

  private async linkEventIn(
    manager: EntityManager,
    context: RequestContext,
    input: { rca: RCA; event: ProductionEvent; reason: string | null },
  ): Promise<Omit<RcaLinkResultV2View, 'caseCreated'>> {
    const { rca, event } = input;
    const existing = await this.existing(manager, rca.id, 'event', event.id);
    if (existing) return this.result(rca, existing, false);
    assertCaseOpen(rca);
    const evidence = await eventEvidencePackage(
      manager,
      rca.tenantId ?? '',
      event,
    );
    const link = await this.insert(manager, context, {
      rca,
      linkType: 'event',
      targetId: event.id,
      target: {
        unitId: event.unitId,
        targetRevision: event.rowVersion,
        evidence: { ...evidence },
      },
      reason: input.reason,
    });
    const actor = actorFromContext(context);
    await moveEventRcaState(manager, {
      eventId: event.id,
      tenantId: rca.tenantId ?? '',
      rcaId: rca.id,
      state: 'linked',
      actor,
    });
    await manager.query(
      `UPDATE "rca_trigger_evaluations" SET "state" = 'accepted', "rca_id" = $3, "resolved_by" = $4, "resolved_at" = now(),
              "row_version" = "row_version" + 1, "updated_at" = now()
        WHERE "tenant_id" = $1 AND "event_id" = $2 AND "state" = 'open'`,
      [rca.tenantId, event.id, rca.id, actor.id],
    );
    return this.result(rca, link, true);
  }

  private existing(
    manager: EntityManager,
    rcaId: string,
    linkType: RcaLinkType,
    targetId: string,
  ): Promise<RcaCaseLink | null> {
    return manager
      .getRepository(RcaCaseLink)
      .findOneBy({ rcaId, linkType, targetId });
  }

  private async insert(
    manager: EntityManager,
    context: RequestContext,
    input: LinkInput,
  ): Promise<RcaCaseLink> {
    const repository = manager.getRepository(RcaCaseLink);
    const saved = await repository.save(
      repository.create({
        tenantId: input.rca.tenantId ?? '',
        rcaId: input.rca.id,
        linkType: input.linkType,
        targetId: input.targetId,
        targetRevision: input.target.targetRevision,
        unitId: input.target.unitId,
        source: 'user',
        linkedBy: actorFromContext(context).id,
        linkedAt: new Date(),
        reason: input.reason,
        evidence: input.target.evidence,
        createdBy: actorFromContext(context).id,
      }),
    );
    await recordRcaAudit(manager, scopeOf(context), [
      {
        entityType: 'rca_case_link',
        entityId: saved.id,
        caseId: saved.rcaId,
        action: 'created',
        before: null,
        after: saved,
        reason: saved.reason,
        detail: { linkType: saved.linkType, targetId: saved.targetId },
      },
    ]);
    return saved;
  }

  private result(
    rca: RCA,
    link: RcaCaseLink,
    created: boolean,
  ): Omit<RcaLinkResultV2View, 'caseCreated'> {
    return { link: toLinkView(link), created, rca: toRcaCaseSummary(rca) };
  }
}
