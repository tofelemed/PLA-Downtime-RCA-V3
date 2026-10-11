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

/** Periods per keyset page of a scope fold: one bulk load per page (never N+1), bounded memory. */
export const SCOPE_PAGE_SIZE = 500;

/** The revision a report shows: published only, or published else the open draft (like the 2.7 reports). */
export const shownSelector = (scope: ReportScope): RevisionSelector =>
  scope.approvedOnly ? 'approved' : 'shown';

export interface ScopeFoldInput {
  context: RequestContext;
  scope: ReportScope;
  selector: RevisionSelector;
  policies: AccountingPoliciesService;
}

/** True when a page shows an open (not approved) revision: its figures are provisional. */
export const hasProvisional = (states: readonly PeriodState[]) =>
  states.some(
    (s) => s.revision !== null && s.revision.lifecycle !== 'approved',
  );

function scopePage(
  periods: Repository<ProductionPeriod>,
  input: ScopeFoldInput,
  after: ProductionPeriod | null,
): Promise<ProductionPeriod[]> {
  const { context, scope } = input;
  const query = scopedQuery(periods, 'p', { context, unitProperty: 'unitId' })
    .andWhere('p.unitId IN (:...unitIds)', { unitIds: scope.unitIds })
    .andWhere('p.utcStart >= :from AND p.utcStart < :to', {
      from: scope.from,
      to: scope.to,
    });
  if (after) {
    query.andWhere(
      '(p.utcStart > :afterStart OR (p.utcStart = :afterStart AND p.id > :afterId))',
      { afterStart: after.utcStart, afterId: after.id },
    );
  }
  return query
    .orderBy('p.utcStart', 'ASC')
    .addOrderBy('p.id', 'ASC')
    .limit(SCOPE_PAGE_SIZE)
    .getMany();
}

/**
 * Folds the periods of a report scope — tenant and unit scope from identity (`scopedQuery`), the scope's
 * units, period start in [from, to) like every 2.7 report — in keyset pages of `SCOPE_PAGE_SIZE` (period
 * start, id): each page is loaded with its selected revision, run, ledger totals, actuals and saved
 * decisions, reconciled by the plan 2.8 arithmetic (`loadPeriodStates`), handed to `visit` and dropped.
 * No period cap: the callers keep accumulators only, so a large plant's window never fails or piles up.
 * Returns whether any page showed an open revision (provisional figures).
 */
export async function foldScopeStates(
  periods: Repository<ProductionPeriod>,
  input: ScopeFoldInput,
  visit: (states: readonly PeriodState[]) => void,
): Promise<boolean> {
  let provisional = false;
  if (input.scope.unitIds.length === 0) return provisional;
  let after: ProductionPeriod | null = null;
  for (;;) {
    const page = await scopePage(periods, input, after);
    if (page.length === 0) return provisional;
    const states = await loadPeriodStates(
      periods.manager,
      page,
      input.selector,
      input.policies,
    );
    provisional = provisional || hasProvisional(states);
    visit(states);
    if (page.length < SCOPE_PAGE_SIZE) return provisional;
    after = page[page.length - 1];
  }
}
