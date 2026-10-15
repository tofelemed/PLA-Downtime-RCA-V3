import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { requireUnitRole } from '../auth/roles/require-unit-role';
import { Clock } from '../common/clock/clock';
import { RequestContext } from '../common/context/request-context';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import {
  parseReconciliationTolerance,
  ReconciliationTolerance,
} from '../periods/engine-policy-bodies';
import { AccountingPolicy } from '../periods/entities/accounting-policy.entity';
import { PolicyBodyError } from '../periods/policy-bodies';
import { invalid } from '../profiles/profile-errors';
import { TOLERANCE_ADOPTERS } from '../v2/uncertainty/uncertainty-roles';
import { UncertaintyBudget } from './entities/uncertainty-budget.entity';
import {
  ToleranceJustification,
  toleranceJustification,
} from './tolerance-justification';
import {
  requireUser,
  UncertaintyBudgetsService,
} from './uncertainty-budgets.service';

const KIND = 'reconciliation_tolerance';

export interface AdoptedTolerance {
  policyId: string;
  version: number;
  unitId: string;
  effectiveFrom: Date;
  body: ReconciliationTolerance;
  justification: ToleranceJustification | null;
}

/**
 * SME E4: an explicit decision to make a budget's expanded uncertainty the unit's absolute
 * reconciliation tolerance ("absolute tolerance = expanded uncertainty"). It writes version n+1 of the
 * unit's `reconciliation_tolerance`, effective now, keeping epsilon, the Unaccounted option and the
 * improvement target of the version in force; the budget must be approved, in force and not past its
 * review, and the person adopting it is not its author. Nothing ever adopts a budget automatically,
 * so the zero default stays until someone decides; periods already calculated keep their version.
 */
@Injectable()
export class ToleranceAdoptionService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly budgets: UncertaintyBudgetsService,
    private readonly policies: AccountingPoliciesService,
    private readonly clock: Clock,
  ) {}

  async adopt(
    context: RequestContext,
    budgetId: string,
    notes?: string,
  ): Promise<AdoptedTolerance> {
    const user = requireUser(context);
    const budget = await this.budgets.get(context, budgetId);
    await requireUnitRole(
      this.manager,
      context,
      budget.unitId,
      TOLERANCE_ADOPTERS,
    );
    const now = this.clock.now();
    assertAdoptable(budget, user, now);
    return this.manager.transaction(async (manager) => {
      const engine = await this.policies.resolveEngine(
        manager,
        { tenantId: budget.tenantId, unitId: budget.unitId },
        now,
      );
      const body = checked({
        ...engine.tolerance,
        mode: 'absolute',
        value: Number(budget.expandedUncertainty),
        uncertaintyBudgetId: budget.id,
      });
      const row = await writeVersion(
        manager,
        { budget, body, user, now },
        notes,
      );
      return {
        policyId: row.id,
        version: row.version,
        unitId: budget.unitId,
        effectiveFrom: row.effectiveFrom,
        body,
        justification: await toleranceJustification(
          manager,
          budget.tenantId,
          body,
          now,
        ),
      };
    });
  }
}

function assertAdoptable(
  budget: UncertaintyBudget,
  user: string,
  now: Date,
): void {
  if (budget.authorId === user) {
    throw new ForbiddenException({
      code: 'SEPARATION_OF_DUTIES',
      message:
        'a budget is adopted as a tolerance by someone other than its author',
    });
  }
  const inForce =
    budget.state === 'approved' &&
    budget.effectiveFrom.getTime() <= now.getTime() &&
    (budget.effectiveTo === null ||
      budget.effectiveTo.getTime() > now.getTime());
  if (!inForce) {
    throw invalid(
      'BUDGET_NOT_IN_FORCE',
      'only an approved budget in force today can justify a tolerance',
    );
  }
  if (budget.reviewDueAt.getTime() <= now.getTime()) {
    throw invalid(
      'BUDGET_REVIEW_OVERDUE',
      'the budget is past its review date; review it before adopting it',
    );
  }
}

/** The new body, checked by the parser the engine applies (422 INVALID_POLICY). */
function checked(body: ReconciliationTolerance): ReconciliationTolerance {
  try {
    return parseReconciliationTolerance(body);
  } catch (error: unknown) {
    if (error instanceof PolicyBodyError) {
      throw invalid('INVALID_POLICY', error.message);
    }
    throw error;
  }
}

/** Version n+1 of the unit's tolerance under a per-scope lock; the open version of the scope ends now. */
async function writeVersion(
  manager: EntityManager,
  change: {
    budget: UncertaintyBudget;
    body: ReconciliationTolerance;
    user: string;
    now: Date;
  },
  notes?: string,
): Promise<AccountingPolicy> {
  const { budget, body, user, now } = change;
  const scopeKey = budget.unitId;
  await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `accounting_policies:${budget.tenantId}:${KIND}:${scopeKey}`,
  ]);
  const [{ next }] = await manager.query<Array<{ next: number }>>(
    `SELECT coalesce(max("version"), 0) + 1 AS "next" FROM "accounting_policies"
      WHERE "tenant_id" = $1 AND "policy_kind" = $2 AND "scope_key" = $3`,
    [budget.tenantId, KIND, scopeKey],
  );
  await manager.query(
    `UPDATE "accounting_policies" SET "effective_to" = $4, "updated_by" = $5
      WHERE "tenant_id" = $1 AND "policy_kind" = $2 AND "scope_key" = $3
        AND "effective_to" IS NULL AND "effective_from" < $4`,
    [budget.tenantId, KIND, scopeKey, now, user],
  );
  const note =
    notes?.trim() ||
    `Absolute tolerance = expanded uncertainty ${budget.expandedUncertainty} ${budget.uom} (k = ${budget.coverageFactor}) of the ${budget.boundary} budget (SME E4).`;
  return manager.save(
    manager.create(AccountingPolicy, {
      tenantId: budget.tenantId,
      policyKind: KIND,
      unitId: budget.unitId,
      scopeKey,
      version: next,
      body: { ...body },
      effectiveFrom: now,
      effectiveTo: null,
      approvedBy: user,
      approvedAt: now,
      notes: note,
      createdBy: user,
      updatedBy: user,
    }),
  );
}
