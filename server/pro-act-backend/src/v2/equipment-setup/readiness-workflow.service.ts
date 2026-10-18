import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { CalculationRun } from '../../accounting/entities/calculation-run.entity';
import { DayCertification } from '../../close/entities/day-certification.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { PlanVersion } from '../../plans/entities/plan-version.entity';
import { PlanPeriod } from '../../plans/entities/plan-period.entity';
import { PlanProductSlice } from '../../plans/entities/plan-product-slice.entity';
import { PeriodProductSlice } from '../../periods/entities/period-product-slice.entity';
import { check } from './readiness-checks';
import { ReadinessStore } from './readiness-store';
import { EquipmentReadinessQueryDto } from './readiness-v2.dto';

@Injectable()
export class ReadinessWorkflowService {
  constructor(private readonly store: ReadinessStore) {}
  async read(context: RequestContext, query: EquipmentReadinessQueryDto) {
    const [plan, period] = await Promise.all([
      this.plan(context, query),
      this.period(context, query),
    ]);
    return [
      plan,
      ...period,
      check(
        'events',
        'not_checked',
        'Review the period coding gate and required failure/quality evidence. An empty Event Hub is not proof that coding is complete.',
      ),
      check(
        'analysis',
        'not_checked',
        'Review Downtime and Production Loss Analysis for the same scope, dates and ledger after the period is approved.',
      ),
    ];
  }
  private async plan(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
  ) {
    if (!query.planId)
      return check(
        'plan',
        'not_checked',
        'Open the saved plan while following the guide so it can check that specific plan.',
      );
    const row = await this.store
      .query(PlanVersion, context, 'unitId')
      .andWhere('r.planId = :planId AND r.unitId = :unitId', query)
      .orderBy('r.version', 'DESC')
      .getOne();
    if (!row)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Plan not found for this unit',
      });
    const periods = await this.store
      .query(PlanPeriod, context, 'unitId')
      .andWhere(
        'r.planVersionId = :id AND r.utcStart < :to AND r.utcEnd > :from',
        { id: row.id, ...query },
      )
      .getExists();
    const ready =
      row.approvalState === 'approved' &&
      periods &&
      row.validFrom <= new Date(query.from) &&
      row.validTo >= new Date(query.to);
    const product = query.productId
      ? await this.store
          .query(PlanProductSlice, context, 'unitId')
          .andWhere(
            'r.planVersionId = :id AND r.productId = :productId AND r.activeFrom < :to AND r.activeTo > :from',
            { id: row.id, ...query },
          )
          .getExists()
      : false;
    return check(
      'plan',
      ready && product ? 'ready' : 'needs_attention',
      `Latest saved plan version ${row.version}: ${row.approvalState}; ${periods ? 'generated periods overlap this window' : 'no generated periods in this window'}. ${ready && product ? 'The approved plan covers the window and contains the selected product.' : 'Review approval, generation, dates and the selected product.'}`,
    );
  }
  private async period(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
  ) {
    if (!query.periodId)
      return ['period', 'day'].map((id) =>
        check(
          id,
          'not_checked',
          'Open a generated production period while following the guide to check that period and its day.',
        ),
      );
    const period = await this.store
      .query(ProductionPeriod, context, 'unitId')
      .andWhere('r.id = :periodId AND r.unitId = :unitId', query)
      .getOne();
    if (!period)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Production period not found for this unit',
      });
    const revision = await this.store
      .query(AccountingRevision, context)
      .andWhere('r.periodId = :id', { id: period.id })
      .orderBy('r.revision', 'DESC')
      .getOne();
    const run = revision?.currentRunId
      ? await this.store
          .query(CalculationRun, context)
          .andWhere('r.id = :id AND r.periodId = :periodId', {
            id: revision.currentRunId,
            periodId: period.id,
          })
          .getOne()
      : null;
    const day = await this.store
      .query(DayCertification, context, 'unitId')
      .andWhere(
        'r.unitId = :unitId AND r.localDate = :date AND r.state = :state',
        { unitId: period.unitId, date: period.localDate, state: 'certified' },
      )
      .getOne();
    const inWindow =
      period.utcStart < new Date(query.to) &&
      period.utcEnd > new Date(query.from);
    const product = query.productId
      ? await this.store
          .query(PeriodProductSlice, context)
          .andWhere(
            'r.periodId = :id AND r.productId = :productId AND r.supersededAt IS NULL',
            { id: period.id, productId: query.productId },
          )
          .getExists()
      : false;
    const planMatches =
      !query.planId ||
      !!(await this.store
        .query(PlanVersion, context, 'unitId')
        .andWhere('r.id = :id AND r.planId = :planId', {
          id: period.selectedPlanVersionId,
          planId: query.planId,
        })
        .getOne());
    const ready =
      inWindow &&
      product &&
      planMatches &&
      revision?.lifecycle === 'approved' &&
      !revision.isStale &&
      run?.status === 'validated' &&
      run.inputHash === revision.inputHash &&
      run.actualsRunId === period.currentActualsRunId;
    return [
      check(
        'period',
        ready ? 'ready' : 'needs_attention',
        `Remembered period ${period.localDate}: ${revision?.lifecycle ?? 'no accounting revision'}; current calculation ${run?.status ?? 'missing'}. ${inWindow ? '' : 'This period does not overlap the selected window. '}${ready ? 'The saved current calculation and accounting approval exist; review evidence in its workspace.' : 'Recompute/review/approve the current period and resolve its gates.'}`,
      ),
      check(
        'day',
        day && inWindow ? 'ready' : 'needs_attention',
        day && inWindow
          ? `The production day ${period.localDate} has an active saved certification.`
          : `The selected production day ${period.localDate} needs certification or the readiness window needs correcting.`,
      ),
    ];
  }
}
