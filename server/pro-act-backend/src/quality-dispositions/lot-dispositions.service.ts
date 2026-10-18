import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { requireUnitRole } from '../auth/roles/require-unit-role';
import { Clock } from '../common/clock/clock';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { Dec, ZERO } from '../domain/actuals/decimal';
import { periodScopeUnits } from '../periods/period-scope';
import { requestRecalculation } from '../periods/period-recalc';
import {
  invalid,
  invalidReference,
  invalidTransition,
  notFound,
} from '../profiles/profile-errors';
import { ProfileReferences } from '../profiles/profile-references';
import {
  DISPOSITION_APPROVERS,
  DISPOSITION_WRITERS,
} from '../v2/quality-dispositions/disposition-roles';
import {
  LotDisposition,
  LotDispositionState,
} from './entities/lot-disposition.entity';
import {
  CheckedShape,
  checkRecovery,
  checkShape,
  NewLotDisposition,
} from './lot-disposition-rules';

const WHAT = 'Lot disposition';

function requireUser(context: RequestContext): string {
  if (!context.userId) {
    throw new ForbiddenException({
      code: 'USER_REQUIRED',
      message: 'an identified user is required',
    });
  }
  return context.userId;
}

/** Σ quantity of the recoveries of a disposition in the given states, other than `exceptId`. */
async function recoveredOf(
  manager: EntityManager,
  originalId: string,
  states: LotDispositionState[],
  exceptId?: string,
): Promise<Dec> {
  const rows = await manager.find(LotDisposition, {
    where: { recoveryOfId: originalId, state: In(states) },
    select: { id: true, quantity: true },
  });
  return rows
    .filter((row) => row.id !== exceptId)
    .reduce((sum, row) => sum.plus(row.quantity), ZERO);
}

/** The periods of the unit over the lot's production interval are recalculated (actuals first). */
async function recalculate(
  manager: EntityManager,
  rows: readonly LotDisposition[],
  context: RequestContext,
): Promise<void> {
  for (const row of rows) {
    await requestRecalculation(manager, {
      tenantId: row.tenantId,
      unitIds: [row.unitId],
      from: row.productionStart,
      to: row.productionEnd,
      reason: 'lot_disposition_approved',
      scopeUnitIds: periodScopeUnits(context),
      requestedBy: context.userId,
    });
  }
}

/**
 * Lot dispositions and recovery movements (SME E3): proposed by production or operations for a unit and
 * product in the caller's scope, approved or rejected by someone other than the author (403
 * SEPARATION_OF_DUTIES, also a CHECK). A recovery names an approved downgrade, transition off-grade or
 * rework and never recovers more than it held; a correction supersedes an approved row, which keeps its
 * row (`superseded`). Approval recalculates the periods of the lot's production interval; an approved
 * row never changes again except to `superseded`, so earlier actuals runs stay reproducible.
 */
@Injectable()
export class LotDispositionsService {
  constructor(
    @InjectRepository(LotDisposition)
    private readonly rows: Repository<LotDisposition>,
    private readonly references: ProfileReferences,
    private readonly clock: Clock,
  ) {}

  async propose(
    context: RequestContext,
    input: NewLotDisposition,
  ): Promise<LotDisposition> {
    const author = requireUser(context);
    await this.references.assertUnit(context, input.unitId);
    await requireUnitRole(
      this.rows.manager,
      context,
      input.unitId,
      DISPOSITION_WRITERS,
    );
    await this.references.assertProduct(context, input.productId);
    const uom = input.uom.trim();
    const shape = checkShape(input, this.clock.now());
    await this.assertLinks(context, input, { ...shape, uom });
    return this.rows.save(
      this.rows.create({
        tenantId: requireTenantId(context),
        unitId: input.unitId,
        productId: input.productId,
        lotCode: input.lotCode.trim(),
        dispositionClass: input.dispositionClass,
        quantity: input.quantity,
        uom,
        productionStart: shape.start,
        productionEnd: shape.end,
        labReleasedAt: input.labReleasedAt
          ? new Date(input.labReleasedAt)
          : null,
        recoveryOfId: input.recoveryOfId ?? null,
        remeasured: input.remeasured ?? false,
        productionEventId: input.productionEventId ?? null,
        supersedesId: input.supersedesId ?? null,
        reason: input.reason?.trim() || null,
        evidenceRef: input.evidenceRef?.trim() || null,
        authorId: author,
        state: 'proposed',
        createdBy: author,
        updatedBy: author,
      }),
    );
  }

  async get(context: RequestContext, id: string): Promise<LotDisposition> {
    const found = await this.inScope(context, id);
    if (!found) throw notFound(WHAT);
    return found;
  }

  private inScope(
    context: RequestContext,
    id: string,
  ): Promise<LotDisposition | null> {
    return scopedQuery(this.rows, 'd', { context, unitProperty: 'unitId' })
      .andWhere('d.id = :id', { id })
      .getOne();
  }

  approve(
    context: RequestContext,
    id: string,
    reason?: string,
  ): Promise<LotDisposition> {
    return this.decide(context, id, {
      state: 'approved',
      reason: reason ?? null,
    });
  }

  reject(
    context: RequestContext,
    id: string,
    reason: string,
  ): Promise<LotDisposition> {
    return this.decide(context, id, { state: 'rejected', reason });
  }

  private async decide(
    context: RequestContext,
    id: string,
    decision: { state: 'approved' | 'rejected'; reason: string | null },
  ): Promise<LotDisposition> {
    const decider = requireUser(context);
    const row = await this.get(context, id);
    await requireUnitRole(
      this.rows.manager,
      context,
      row.unitId,
      DISPOSITION_APPROVERS,
    );
    if (!context.isSuperAdmin && row.authorId === decider) {
      throw new ForbiddenException({
        code: 'SEPARATION_OF_DUTIES',
        message:
          'a lot disposition is approved or rejected by someone other than its author',
      });
    }
    return this.rows.manager.transaction(async (manager) => {
      const result = await manager.update(
        LotDisposition,
        { id, state: 'proposed' },
        {
          state: decision.state,
          decidedBy: decider,
          superAdminOverride: context.isSuperAdmin && row.authorId === decider,
          decidedAt: new Date(),
          decisionReason: decision.reason,
          updatedBy: decider,
        },
      );
      if (!result.affected)
        throw invalidTransition('lot disposition', row.state, decision.state);
      if (decision.state === 'approved')
        await this.applyApproval(manager, row, context);
      return manager.findOneByOrFail(LotDisposition, { id });
    });
  }

  /** Re-checks the recovery bound, supersedes the corrected row and requests the recalculation (of the recovered lot too). */
  private async applyApproval(
    manager: EntityManager,
    row: LotDisposition,
    context: RequestContext,
  ): Promise<void> {
    let original: LotDisposition | null = null;
    if (row.recoveryOfId) {
      original = await manager.findOneByOrFail(LotDisposition, {
        id: row.recoveryOfId,
      });
      checkRecovery(
        {
          quantity: new Dec(row.quantity),
          start: row.productionStart,
          end: row.productionEnd,
          uom: row.uom,
        },
        original,
        await recoveredOf(manager, original.id, ['approved'], row.id),
      );
    }
    const superseded = row.supersedesId
      ? await this.supersede(manager, row.supersedesId, context)
      : null;
    // valuation 2.8.0: a recovery changes the yield loss of the original lot, so its periods recalculate too
    await recalculate(
      manager,
      [
        row,
        ...(superseded ? [superseded] : []),
        ...(original ? [original] : []),
      ],
      context,
    );
  }

  private async supersede(
    manager: EntityManager,
    id: string,
    context: RequestContext,
  ): Promise<LotDisposition> {
    const result = await manager.update(
      LotDisposition,
      { id, state: 'approved' },
      {
        state: 'superseded',
        supersededAt: new Date(),
        updatedBy: context.userId,
      },
    );
    if (!result.affected) {
      throw invalid(
        'INVALID_SUPERSEDE',
        'the corrected disposition is no longer approved',
      );
    }
    return manager.findOneByOrFail(LotDisposition, { id });
  }

  /** Recovery, correction and source event must be the tenant's, in scope and consistent (422). */
  private async assertLinks(
    context: RequestContext,
    input: NewLotDisposition,
    shape: CheckedShape & { uom: string },
  ): Promise<void> {
    const manager = this.rows.manager;
    if (input.recoveryOfId) {
      const original = await this.linked(
        context,
        input.recoveryOfId,
        'recoveryOfId',
      );
      const open = await recoveredOf(manager, original.id, [
        'proposed',
        'approved',
      ]);
      checkRecovery(shape, original, open);
    }
    if (input.supersedesId) {
      const old = await this.linked(
        context,
        input.supersedesId,
        'supersedesId',
      );
      const same =
        old.unitId === input.unitId && old.productId === input.productId;
      if (old.state !== 'approved' || !same) {
        throw invalid(
          'INVALID_SUPERSEDE',
          'a correction supersedes an approved disposition of the same unit and product',
        );
      }
    }
    if (input.productionEventId) {
      const rows: unknown[] = await manager.query(
        `SELECT 1 FROM "production_events" WHERE "id" = $1 AND "tenant_id" = $2 AND "unit_id" = $3`,
        [input.productionEventId, requireTenantId(context), input.unitId],
      );
      if (rows.length === 0)
        throw invalidReference(
          'productionEventId',
          'production event of the unit',
        );
    }
  }

  private async linked(
    context: RequestContext,
    id: string,
    field: string,
  ): Promise<LotDisposition> {
    const found = await this.inScope(context, id);
    if (!found) throw invalidReference(field, 'lot disposition');
    return found;
  }
}
