import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { requireUnitRole } from '../auth/roles/require-unit-role';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import {
  invalid,
  invalidTransition,
  notFound,
} from '../profiles/profile-errors';
import { ProfileReferences } from '../profiles/profile-references';
import {
  BUDGET_APPROVERS,
  BUDGET_WRITERS,
} from '../v2/uncertainty/uncertainty-roles';
import { UncertaintyBudget } from './entities/uncertainty-budget.entity';
import {
  checkDates,
  computeBudget,
  ComputedBudget,
  NewUncertaintyBudget,
  UncertaintyBudgetMaths,
} from './uncertainty-budget-rules';

const WHAT = 'Uncertainty budget';

export function requireUser(context: RequestContext): string {
  if (!context.userId) {
    throw new ForbiddenException({
      code: 'USER_REQUIRED',
      message: 'an identified user is required',
    });
  }
  return context.userId;
}

/**
 * SME E4 uncertainty budgets: proposed for a unit's measurement boundary in the caller's scope (the
 * server computes the combined and expanded uncertainty), approved or rejected by someone other than
 * the author (403 SEPARATION_OF_DUTIES, also a CHECK). Approval makes the budget the one in force from
 * its effective date and ends the previous approved budget of the unit and boundary there (kept, so
 * a tolerance that referenced it keeps its justification). An approved budget never changes again.
 */
@Injectable()
export class UncertaintyBudgetsService {
  constructor(
    @InjectRepository(UncertaintyBudget)
    private readonly rows: Repository<UncertaintyBudget>,
    private readonly references: ProfileReferences,
  ) {}

  /** The server's computation of a draft, nothing stored. */
  preview(input: UncertaintyBudgetMaths): ComputedBudget {
    return computeBudget(input);
  }

  async propose(
    context: RequestContext,
    input: NewUncertaintyBudget,
  ): Promise<UncertaintyBudget> {
    const author = requireUser(context);
    await this.references.assertUnit(context, input.unitId);
    await requireUnitRole(
      this.rows.manager,
      context,
      input.unitId,
      BUDGET_WRITERS,
    );
    const dates = checkDates(input);
    const computed = computeBudget(input);
    return this.rows.save(
      this.rows.create({
        tenantId: requireTenantId(context),
        unitId: input.unitId,
        boundary: input.boundary.trim(),
        uom: input.uom.trim(),
        components: computed.components,
        correlations: computed.correlations,
        coverageFactor: computed.result.coverageFactor,
        combinedStandardUncertainty:
          computed.result.combinedStandardUncertainty,
        expandedUncertainty: computed.result.expandedUncertainty,
        calibrationRef: input.calibrationRef.trim(),
        reviewDueAt: dates.reviewDueAt,
        evidenceRef: input.evidenceRef?.trim() || null,
        notes: input.notes?.trim() || null,
        effectiveFrom: dates.effectiveFrom,
        effectiveTo: null,
        authorId: author,
        state: 'proposed',
        createdBy: author,
        updatedBy: author,
      }),
    );
  }

  async get(context: RequestContext, id: string): Promise<UncertaintyBudget> {
    const found = await scopedQuery(this.rows, 'b', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('b.id = :id', { id })
      .getOne();
    if (!found) throw notFound(WHAT);
    return found;
  }

  approve(
    context: RequestContext,
    id: string,
    reason?: string,
  ): Promise<UncertaintyBudget> {
    return this.decide(context, id, {
      state: 'approved',
      reason: reason ?? null,
    });
  }

  reject(
    context: RequestContext,
    id: string,
    reason: string,
  ): Promise<UncertaintyBudget> {
    return this.decide(context, id, { state: 'rejected', reason });
  }

  private async decide(
    context: RequestContext,
    id: string,
    decision: { state: 'approved' | 'rejected'; reason: string | null },
  ): Promise<UncertaintyBudget> {
    const decider = requireUser(context);
    const row = await this.get(context, id);
    await requireUnitRole(
      this.rows.manager,
      context,
      row.unitId,
      BUDGET_APPROVERS,
    );
    if (row.authorId === decider) {
      throw new ForbiddenException({
        code: 'SEPARATION_OF_DUTIES',
        message:
          'an uncertainty budget is approved or rejected by someone other than its author',
      });
    }
    return this.rows.manager.transaction(async (manager) => {
      if (decision.state === 'approved')
        await endPrevious(manager, row, decider);
      const result = await manager.update(
        UncertaintyBudget,
        { id, state: 'proposed' },
        {
          state: decision.state,
          decidedBy: decider,
          decidedAt: new Date(),
          decisionReason: decision.reason,
          updatedBy: decider,
        },
      );
      if (!result.affected)
        throw invalidTransition(
          'uncertainty budget',
          row.state,
          decision.state,
        );
      return manager.findOneByOrFail(UncertaintyBudget, { id });
    });
  }
}

/**
 * The approved open budget of the unit and boundary ends where the new one starts (per-boundary lock);
 * a new budget must start after the one in force (422 INVALID_EFFECTIVE_FROM).
 */
async function endPrevious(
  manager: EntityManager,
  row: UncertaintyBudget,
  decider: string,
): Promise<void> {
  await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `uncertainty_budgets:${row.tenantId}:${row.unitId}:${row.boundary}`,
  ]);
  const current = await manager
    .getRepository(UncertaintyBudget)
    .createQueryBuilder('b')
    .where('b.tenantId = :tenantId AND b.unitId = :unitId', {
      tenantId: row.tenantId,
      unitId: row.unitId,
    })
    .andWhere('b.boundary = :boundary', { boundary: row.boundary })
    .andWhere(`b.state = 'approved' AND b.effectiveTo IS NULL`)
    .getOne();
  if (!current) return;
  if (current.effectiveFrom.getTime() >= row.effectiveFrom.getTime()) {
    throw invalid(
      'INVALID_EFFECTIVE_FROM',
      'a new budget of this boundary takes effect after the one in force',
    );
  }
  await manager.update(
    UncertaintyBudget,
    { id: current.id },
    { effectiveTo: row.effectiveFrom, updatedBy: decider },
  );
}
