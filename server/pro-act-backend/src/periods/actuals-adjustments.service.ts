import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { toDec } from '../domain/actuals/decimal';
import {
  invalid,
  invalidReference,
  invalidTransition,
  notFound,
} from '../profiles/profile-errors';
import { ActualsAdjustment } from './entities/actuals-adjustment.entity';
import { PeriodProductSlice } from './entities/period-product-slice.entity';
import { ProductionPeriod } from './entities/production-period.entity';
import { periodScopeUnits } from './period-scope';
import { requestRecalculation } from './period-recalc';

export interface AdjustmentProposal {
  sliceId: string;
  kind: ActualsAdjustment['kind'];
  quantity: string;
  basis: ActualsAdjustment['basis'];
  reason: string;
  evidenceRef: string;
  windowFrom?: string;
  windowTo?: string;
}

/**
 * Governed manual actuals (plan 2.4 step 3, ACT06): a proposal names an active slice of the caller's
 * scope, a component, a signed quantity in the slice unit, a basis, a reason, evidence and optionally the
 * measurement window inside the slice; approval or rejection is by someone other than the author (403
 * SEPARATION_OF_DUTIES, also a CHECK in the table). An approval requests a recalculation of the period,
 * which writes a new actuals run where the adjustment is a separate component; raw data never changes.
 */
@Injectable()
export class ActualsAdjustmentsService {
  constructor(
    @InjectRepository(ActualsAdjustment)
    private readonly adjustments: Repository<ActualsAdjustment>,
  ) {}

  async propose(
    context: RequestContext,
    body: AdjustmentProposal,
  ): Promise<ActualsAdjustment> {
    const author = requireUser(context);
    const slice = await this.activeSlice(context, body.sliceId);
    const window = windowOf(body, slice);
    const quantity = toDec(body.quantity);
    if (!quantity || quantity.isZero()) {
      throw invalid('INVALID_QUANTITY', 'quantity must be a non-zero decimal');
    }
    const period = await this.adjustments.manager.findOneByOrFail(
      ProductionPeriod,
      { id: slice.periodId },
    );
    return this.adjustments.save(
      this.adjustments.create({
        tenantId: slice.tenantId,
        sliceId: slice.id,
        periodId: slice.periodId,
        unitId: period.unitId,
        kind: body.kind,
        quantity: body.quantity,
        uom: slice.quantityUom,
        basis: body.basis,
        reason: body.reason,
        evidenceRef: body.evidenceRef,
        windowFrom: window?.from ?? null,
        windowTo: window?.to ?? null,
        authorId: author,
        state: 'proposed',
        createdBy: author,
        updatedBy: author,
      }),
    );
  }

  async get(context: RequestContext, id: string): Promise<ActualsAdjustment> {
    const found = await scopedQuery(this.adjustments, 'a', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('a.id = :id', { id })
      .getOne();
    if (!found) throw notFound('Actuals adjustment');
    return found;
  }

  approve(
    context: RequestContext,
    id: string,
    reason?: string,
  ): Promise<ActualsAdjustment> {
    return this.decide(context, id, {
      state: 'approved',
      reason: reason ?? null,
    });
  }

  reject(
    context: RequestContext,
    id: string,
    reason: string,
  ): Promise<ActualsAdjustment> {
    return this.decide(context, id, { state: 'rejected', reason });
  }

  private async decide(
    context: RequestContext,
    id: string,
    decision: { state: 'approved' | 'rejected'; reason: string | null },
  ): Promise<ActualsAdjustment> {
    const decider = requireUser(context);
    const adjustment = await this.get(context, id);
    if (adjustment.authorId === decider) {
      throw new ForbiddenException({
        code: 'SEPARATION_OF_DUTIES',
        message:
          'an actuals adjustment is approved or rejected by someone other than its author',
      });
    }
    return this.adjustments.manager.transaction(async (manager) => {
      const result = await manager.update(
        ActualsAdjustment,
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
        throw invalidTransition('adjustment', adjustment.state, decision.state);
      if (decision.state === 'approved') {
        await recalculate(manager, adjustment, context);
      }
      return manager.findOneByOrFail(ActualsAdjustment, { id });
    });
  }

  /** The slice must be active, of the tenant and of a unit in the caller's scope (422 otherwise). */
  private async activeSlice(
    context: RequestContext,
    sliceId: string,
  ): Promise<PeriodProductSlice> {
    const slice = await this.adjustments.manager.findOne(PeriodProductSlice, {
      where: { id: sliceId, tenantId: requireTenantId(context) },
    });
    const period = slice
      ? await this.adjustments.manager.findOneBy(ProductionPeriod, {
          id: slice.periodId,
        })
      : null;
    const allowed = periodScopeUnits(context);
    if (!slice || !period || (allowed && !allowed.includes(period.unitId))) {
      throw invalidReference('sliceId', 'period slice');
    }
    if (slice.supersededAt) {
      throw invalid(
        'SLICE_SUPERSEDED',
        'the slice was replaced; adjust the current slice of the period',
      );
    }
    return slice;
  }
}

/** An approved adjustment recalculates its period, within the approver's unit scope. */
async function recalculate(
  manager: EntityManager,
  adjustment: ActualsAdjustment,
  context: RequestContext,
): Promise<void> {
  const period = await manager.findOneByOrFail(ProductionPeriod, {
    id: adjustment.periodId,
  });
  await requestRecalculation(manager, {
    tenantId: adjustment.tenantId,
    unitIds: [adjustment.unitId],
    from: period.utcStart,
    to: period.utcEnd,
    reason: 'adjustment_approved',
    scopeUnitIds: periodScopeUnits(context),
    requestedBy: context.userId,
  });
}

function requireUser(context: RequestContext): string {
  if (!context.userId) {
    throw new ForbiddenException({
      code: 'USER_REQUIRED',
      message: 'an identified user is required',
    });
  }
  return context.userId;
}

/** The measurement window must lie inside the slice window (both bounds or neither). */
function windowOf(
  body: AdjustmentProposal,
  slice: PeriodProductSlice,
): { from: Date; to: Date } | null {
  if (!body.windowFrom && !body.windowTo) return null;
  if (!body.windowFrom || !body.windowTo) {
    throw invalid('INVALID_RANGE', 'windowFrom and windowTo go together');
  }
  const from = new Date(body.windowFrom);
  const to = new Date(body.windowTo);
  if (!(from < to) || from < slice.windowFrom || to > slice.windowTo) {
    throw invalid(
      'INVALID_RANGE',
      'the measurement window must be a non-empty part of the slice window',
    );
  }
  return { from, to };
}
