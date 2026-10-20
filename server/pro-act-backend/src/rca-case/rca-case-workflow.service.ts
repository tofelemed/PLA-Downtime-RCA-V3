import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import { RequestContext } from '../common/context/request-context';
import {
  independenceConflict,
  statusOf,
  Transition,
  transitionOf,
  nextStatuses,
  TRANSITIONS,
  withInvestigators,
} from '../domain/rca/case-workflow';
import {
  closeReadiness,
  CloseReadiness,
  RootCauseRule,
} from '../domain/rca/close-gate';
import {
  GateResult,
  investigationGate,
  InvestigationFacts,
} from '../domain/rca/investigation-gate';
import { RcaPolicy } from '../domain/rca/rca-policy';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { actorFromContext } from '../production-event/revisions/revision-actor';
import { RCA } from '../rca/rca.entity';
import { RcaCaseTransitionV2Dto } from '../v2/rca/rca-cases-v2.dto';
import {
  caseActions,
  closeActions,
  investigationFacts,
} from './case-gate-facts';
import { casePolicy } from './case-policy';
import { codedRootCauses } from './cause-rules';
import { caseAudit, recordRcaAudit } from './rca-audit';
import {
  assertIndependentApprover,
  assertNote,
  CLOSE_MESSAGES,
  CLOSURE_APPROVER,
  gateBlocked,
  invalidTransition,
  partiesOf,
} from './case-transition-rules';
import { moveEventRcaState } from './event-rca-pointer';
import { RcaCaseV2View } from './rca-case.view';
import { depthOf, RcaCaseReadinessV2View } from './rca-case-readiness.view';
import { RcaCasesService } from './rca-cases.service';
import { upsertKnowledgeEntry } from './rca-knowledge';
import { recommendationsAtClosure } from './recommendation-actions';
import { findCase, RcaScope, scopeOf } from './rca-scope';
import { acceptReevaluations } from './triggers/recurrence-watch-recorder';

export type { RcaCaseReadinessV2View } from './rca-case-readiness.view';

interface Gates {
  /** the case's class as the gate read it (null when unclassified or not a known class) */
  consequenceClass: InvestigationFacts['consequenceClass'];
  investigation: GateResult;
  closure: CloseReadiness;
  rootCauseRule: RootCauseRule;
}

/** Audit verb of a move: the closure steps by name, every other move as `transitioned`. */
function transitionVerb(transition: Transition): string {
  if (transition.to === 'Closure Review') return 'closure_requested';
  if (transition.to === 'Closed') return 'closed';
  if (transition.from === 'Closure Review') return 'closure_rejected';
  if (transition.from === 'Closed') return 'reopened';
  return 'transitioned';
}

/**
 * RCA-01 / SME CA1 case workflow: the status moves only here, through the state machine of
 * `case-workflow.ts` — investigation accepted (CA5–CA7 gate), effectiveness monitoring, closure requested
 * with evidence, verified effectiveness and residual risk (CA2, CA4), then closed or sent back by a
 * manager approver independent of the investigation. Closing feeds the knowledge base and completes the
 * linked events; reopening a closed case needs the same independence and a reason.
 */
@Injectable()
export class RcaCaseWorkflowService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
    private readonly cases: RcaCasesService,
  ) {}

  async readiness(
    context: RequestContext,
    id: string,
  ): Promise<RcaCaseReadinessV2View> {
    const manager = this.dataSource.manager;
    const scope = scopeOf(context);
    const rca = await findCase(manager, scope, id);
    const policy = await casePolicy(manager, this.policies, rca, new Date());
    const gates = await this.gates(
      manager,
      rca,
      policy,
      rca.residualRisk ?? null,
    );
    const status = statusOf(rca.status);
    return {
      rcaId: rca.id,
      status,
      next: TRANSITIONS.filter((t) => t.from === status).map((t) => ({
        to: t.to,
        gates: [...t.gates],
      })),
      investigation: gates.investigation,
      closure: {
        blockers: gates.closure.blockers.map(
          (blocker) => CLOSE_MESSAGES[blocker],
        ),
        effectiveness: gates.closure.effectiveness,
        rootCauseRule: gates.rootCauseRule,
      },
      approver: this.approverOf(context, rca),
      linkedRecurrences: await this.linkedRecurrences(manager, scope, rca.id),
      rules: {
        fiveWhyGuidelineLevels: policy.fiveWhy.guidelineLevels,
        fiveWhyUnsupportedRootCauses: [...policy.fiveWhy.unsupportedRootCauses],
        consequenceClass: rca.consequenceClass ?? null,
        investigationDepth: depthOf(gates.consequenceClass),
      },
    };
  }

  async transition(
    context: RequestContext,
    target: { id: string; expectedRowVersion: number },
    body: RcaCaseTransitionV2Dto,
  ): Promise<RcaCaseV2View> {
    const scope = scopeOf(context);
    await this.dataSource.transaction(async (manager) => {
      const rca = await findCase(manager, scope, target.id, true);
      assertRevision(rca.rowVersion, target.expectedRowVersion);
      const before = { ...rca };
      const from = statusOf(rca.status);
      const transition = transitionOf(from, body.to);
      if (!transition)
        throw invalidTransition(from, body.to, nextStatuses(from));
      const note = assertNote(transition, body.note);
      if (transition.gates.includes('independent_approval'))
        assertIndependentApprover(context, rca);
      await this.checkGates(manager, {
        rca,
        transition,
        residualRisk: body.residualRisk,
      });
      const changes = this.changesOf(transition, {
        rca,
        scope,
        note,
        residualRisk: body.residualRisk,
      });
      const saved = await manager
        .getRepository(RCA)
        .save({ ...rca, ...changes, status: body.to });
      await recordRcaAudit(manager, scope, [
        caseAudit(transitionVerb(transition), { before, after: saved }, note),
      ]);
      if (body.to === 'Closed')
        await this.onClosed(manager, { scope, context, id: rca.id });
      // D-T3: reopening is the person's answer to the case's open "re-evaluate" recommendations
      if (transition.from === 'Closed')
        await acceptReevaluations(manager, {
          tenantId: scope.tenantId,
          rcaId: rca.id,
          userId: scope.userId,
          now: new Date(),
        });
    });
    return this.cases.get(context, target.id);
  }

  private async gates(
    manager: EntityManager,
    rca: RCA,
    policy: RcaPolicy,
    residualRisk: string | null,
  ): Promise<Gates> {
    const actions = await caseActions(manager, rca);
    const rootCauseRule = {
      coded: rca.codedRootCauseRequired,
      codedRootCauses: await codedRootCauses(manager, rca),
    };
    const facts = await investigationFacts(manager, {
      rca,
      policy,
      actionCount: actions.length,
      codedRootCauses: rootCauseRule.codedRootCauses,
    });
    return {
      consequenceClass: facts.consequenceClass,
      investigation: investigationGate(facts, policy),
      closure: closeReadiness({
        rootCause: rca.rootCause ?? null,
        rootCauseRule,
        actions: closeActions(actions),
        residualRisk,
      }),
      rootCauseRule,
    };
  }

  private async checkGates(
    manager: EntityManager,
    input: {
      rca: RCA;
      transition: Transition;
      residualRisk: string | undefined;
    },
  ): Promise<void> {
    const { rca, transition } = input;
    const closing = transition.to === 'Closed';
    const requesting = transition.gates.includes('closure_request');
    if (!closing && !requesting && !transition.gates.includes('investigation'))
      return;
    const policy = await casePolicy(manager, this.policies, rca, new Date());
    const residualRisk = requesting
      ? (input.residualRisk ?? null)
      : (rca.residualRisk ?? null);
    const gates = await this.gates(manager, rca, policy, residualRisk);
    if (
      transition.gates.includes('investigation') &&
      gates.investigation.blockers.length > 0
    ) {
      throw gateBlocked('INVESTIGATION_BLOCKED', gates.investigation.blockers);
    }
    if ((requesting || closing) && gates.closure.blockers.length > 0) {
      throw gateBlocked(
        'CLOSE_BLOCKED',
        gates.closure.blockers.map((b) => CLOSE_MESSAGES[b]),
      );
    }
    if (requesting) rca.effectivenessVerdict = gates.closure.effectiveness;
  }

  /** Columns a move writes beside the status (closure request, decision, reopening). */
  private changesOf(
    transition: Transition,
    input: {
      rca: RCA;
      scope: RcaScope;
      note: string | null;
      residualRisk: string | undefined;
    },
  ): Partial<RCA> {
    const now = new Date();
    const cleared = { closureApprovedBy: null, closureApprovedAt: null };
    if (transition.to === 'Closure Review') {
      return {
        residualRisk: input.residualRisk?.trim() ?? null,
        closureRequestedBy: input.scope.userId,
        investigatorIds: withInvestigators(input.rca.investigatorIds, [
          input.scope.userId,
        ]),
        closureRequestedAt: now,
        effectivenessVerdict: input.rca.effectivenessVerdict ?? null,
        closureNote: input.note,
        ...cleared,
      };
    }
    if (transition.to === 'Closed') {
      return {
        closureApprovedBy: input.scope.userId,
        closureApprovedAt: now,
        closureNote: input.note,
        actualCloseDate: input.rca.actualCloseDate ?? now,
      };
    }
    const back =
      transition.from === 'Closure Review' || transition.from === 'Closed';
    if (!back) return input.note ? { closureNote: input.note } : {};
    return {
      closureNote: input.note,
      closureRequestedBy: null,
      closureRequestedAt: null,
      effectivenessVerdict: null,
      ...cleared,
      ...(transition.from === 'Closed' ? { actualCloseDate: null } : {}),
    };
  }

  private approverOf(
    context: RequestContext,
    rca: RCA,
  ): RcaCaseReadinessV2View['approver'] {
    if (context.isSuperAdmin && context.userId)
      return { canApprove: true, reason: null };
    if (!context.roles.includes(CLOSURE_APPROVER) && !context.isSuperAdmin) {
      return {
        canApprove: false,
        reason: 'closure is approved by a manager approver',
      };
    }
    const conflict = context.userId
      ? independenceConflict(context.userId, partiesOf(rca))
      : 'creator';
    return conflict
      ? {
          canApprove: false,
          reason: `not independent of the investigation (${conflict.replace('_', ' ')})`,
        }
      : { canApprove: true, reason: null };
  }

  private async linkedRecurrences(
    manager: EntityManager,
    scope: RcaScope,
    id: string,
  ): Promise<number> {
    const rows: Array<{ n: number }> = await manager.query(
      `SELECT count(*)::int AS "n" FROM "rca_trigger_evaluations"
        WHERE "tenant_id" = $1 AND "rca_id" = $2 AND "outcome" = 'linked_to_case'`,
      [scope.tenantId, id],
    );
    return rows[0]?.n ?? 0;
  }

  /** Recommendations whose implementing actions are all finished leave "Open" when the case closes. */
  private async closeRecommendations(
    manager: EntityManager,
    scope: RcaScope,
    rca: RCA,
  ): Promise<void> {
    const recommendations = await recommendationsAtClosure(manager, rca);
    if (recommendations === null) return;
    const before = { ...rca };
    const saved = await manager
      .getRepository(RCA)
      .save({ ...rca, recommendations });
    Object.assign(rca, saved);
    await recordRcaAudit(manager, scope, [
      caseAudit(
        'updated',
        { before, after: saved },
        'closure: recommendations with every action finished completed',
      ),
    ]);
  }

  /** Knowledge entry and `completed` RCA state of every linked event (an independent reviewer closed it). */
  private async onClosed(
    manager: EntityManager,
    input: { scope: RcaScope; context: RequestContext; id: string },
  ): Promise<void> {
    const { scope } = input;
    const rca = await findCase(manager, scope, input.id);
    await this.closeRecommendations(manager, scope, rca);
    await upsertKnowledgeEntry(manager, {
      rca,
      closedBy: scope.userId,
      closedAt: rca.actualCloseDate ?? new Date(),
    });
    const events: Array<{ target_id: string }> = await manager.query(
      `SELECT "target_id" FROM "rca_case_links" WHERE "tenant_id" = $1 AND "rca_id" = $2 AND "link_type" = 'event'`,
      [scope.tenantId, input.id],
    );
    for (const { target_id: eventId } of events) {
      await moveEventRcaState(manager, {
        eventId,
        tenantId: scope.tenantId,
        rcaId: input.id,
        state: 'completed',
        actor: actorFromContext(input.context),
      });
    }
  }
}
