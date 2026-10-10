import { UnprocessableEntityException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import {
  loadPeriodStates,
  PeriodState,
  RevisionSelector,
} from '../period-overview/period-states';
import { ReportScope } from '../reports/report-scope';

/** At most this many periods per state-based report (one bulk load, never N+1). */
export const MAX_SCOPE_PERIODS = 1500;

/** The revision a report shows: published only, or published else the open draft (like the 2.7 reports). */
export const shownSelector = (scope: ReportScope): RevisionSelector =>
  scope.approvedOnly ? 'approved' : 'shown';

/**
 * Periods of a report scope — tenant and unit scope from identity (`scopedQuery`), the scope's units,
 * period start in [from, to) like every 2.7 report — with their selected revision, run, ledger totals,
 * actuals and saved decisions reconciled by the plan 2.8 arithmetic (`loadPeriodStates`). More than
 * `MAX_SCOPE_PERIODS` periods is 422 TOO_MANY_PERIODS (narrow the window or units).
 */
export async function scopeStates(
  periods: Repository<ProductionPeriod>,
  input: {
    context: RequestContext;
    scope: ReportScope;
    selector: RevisionSelector;
    policies: AccountingPoliciesService;
  },
): Promise<PeriodState[]> {
  const { context, scope } = input;
  if (scope.unitIds.length === 0) return [];
  const found = await scopedQuery(periods, 'p', {
    context,
    unitProperty: 'unitId',
  })
    .andWhere('p.unitId IN (:...unitIds)', { unitIds: scope.unitIds })
    .andWhere('p.utcStart >= :from AND p.utcStart < :to', {
      from: scope.from,
      to: scope.to,
    })
    .orderBy('p.utcStart', 'ASC')
    .addOrderBy('p.id', 'ASC')
    .take(MAX_SCOPE_PERIODS + 1)
    .getMany();
  if (found.length > MAX_SCOPE_PERIODS) {
    throw new UnprocessableEntityException({
      code: 'TOO_MANY_PERIODS',
      message: `at most ${MAX_SCOPE_PERIODS} periods per report; narrow the window or the units`,
    });
  }
  return loadPeriodStates(
    periods.manager,
    found,
    input.selector,
    input.policies,
  );
}
