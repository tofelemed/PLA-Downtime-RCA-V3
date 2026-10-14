import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import { RequestContext } from '../common/context/request-context';
import {
  independenceConflict,
  RcaStatus,
  statusOf,
  Transition,
  transitionOf,
  nextStatuses,
  TRANSITIONS,
} from '../domain/rca/case-workflow';
import { closeReadiness, CloseReadiness } from '../domain/rca/close-gate';
import {
  GateIssue,
  GateResult,
  investigationGate,
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
import { RcaCasesService } from './rca-cases.service';
import { upsertKnowledgeEntry } from './rca-knowledge';
import { findCase, RcaScope, scopeOf } from './rca-scope';

/** What the case screen shows about the next moves (RCA-01 / CA1, computed on the server). */
export interface RcaCaseReadinessV2View {
  rcaId: string;
  status: RcaStatus;
  next: Array<{ to: RcaStatus; gates: string[] }>;
  investigation: GateResult;
  closure: {
    blockers: GateIssue[];
    effectiveness: CloseReadiness['effectiveness'];
  };
  /** whether the caller may approve the closure (role and independence), with the reason when not */
  approver: { canApprove: boolean; reason: string | null };
  /** same-problem events linked to this case by the triggers since it opened (CA8 escalation) */
  linkedRecurrences: number;
  rules: { fiveWhyGuidelineLevels: number; consequenceClass: string | null };
}

interface Gates {
  investigation: GateResult;
  closure: CloseReadiness;
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
      },
      approver: this.approverOf(context, rca),
      linkedRecurrences: await this.linkedRecurrences(manager, scope, rca.id),
      rules: {
        fiveWhyGuidelineLevels: policy.fiveWhy.guidelineLevels,
        consequenceClass: rca.consequenceClass ?? null,
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
      await manager
        .getRepository(RCA)
        .save({ ...rca, ...changes, status: body.to });
      if (body.to === 'Closed')
        await this.onClosed(manager, { scope, context, id: rca.id });
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
    const facts = await investigationFacts(manager, {
      rca,
      policy,
      actionCount: actions.length,
    });
    return {
      investigation: investigationGate(facts, policy),
      closure: closeReadiness({
        rootCause: rca.rootCause ?? null,
        actions: closeActions(actions),
        residualRisk,
      }),
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

  /** Knowledge entry and `completed` RCA state of every linked event (an independent reviewer closed it). */
  private async onClosed(
    manager: EntityManager,
    input: { scope: RcaScope; context: RequestContext; id: string },
  ): Promise<void> {
    const { scope } = input;
    const rca = await findCase(manager, scope, input.id);
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
