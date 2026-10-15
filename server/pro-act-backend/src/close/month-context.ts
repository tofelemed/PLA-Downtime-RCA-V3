import { EntityManager } from 'typeorm';
import {
  financialMonth,
  FinancialMonth,
  isMonthKey,
  monthOfDate,
} from '../domain/close/financial-month';
import {
  closeDeadlines,
  CloseDeadlines,
} from '../domain/close/month-close-machine';
import { MonthClosePolicy } from '../domain/close/month-close-policy';
import { invalid } from '../profiles/profile-errors';
import {
  defaultSiteOf,
  endOfLocalDay,
  localDateOf,
  plantCloseCalendar,
  PlantCloseCalendar,
} from './close-calendar';
import { MonthClose } from './entities/month-close.entity';
import {
  PolicyInForce,
  WorkflowPoliciesService,
} from './workflow-policies.service';

/** Everything a month close step or view needs about its month. */
export interface MonthContext {
  tenantId: string;
  month: FinancialMonth;
  policy: PolicyInForce<MonthClosePolicy>;
  row: MonthClose | null;
  calendar: PlantCloseCalendar;
  deadlines: CloseDeadlines;
  dueAt: { quantities: Date; finance: Date };
}

/** `current` = the month containing the plant-local date of `now`. */
export type MonthSelector = { key: string } | 'current';

async function monthFor(
  manager: EntityManager,
  tenantId: string,
  selector: MonthSelector,
  policy: MonthClosePolicy,
  now: Date,
): Promise<FinancialMonth> {
  const calendar = policy.financialCalendar;
  if (selector !== 'current') {
    if (!isMonthKey(selector.key))
      throw invalid('INVALID_MONTH', 'month must be YYYY-MM');
    return financialMonth(selector.key, calendar);
  }
  const site = await defaultSiteOf(manager, tenantId);
  return monthOfDate(localDateOf(now, site?.timezone ?? 'UTC'), calendar);
}

/**
 * The month of a selector under the `month_close` version in force now; once a month was acted on, the
 * version and dates stored on its row win (its deadlines do not move with a later version).
 */
export async function loadMonthContext(
  manager: EntityManager,
  policies: WorkflowPoliciesService,
  input: { tenantId: string; selector: MonthSelector; now: Date },
): Promise<MonthContext> {
  const { tenantId, now } = input;
  const inForce = await policies.monthClose(manager, tenantId, now);
  const candidate = await monthFor(
    manager,
    tenantId,
    input.selector,
    inForce.policy,
    now,
  );
  const row = await manager.findOneBy(MonthClose, {
    tenantId,
    firstDate: candidate.firstDate,
  });
  const policy = row
    ? await policies.monthCloseVersion(manager, row.policyId)
    : inForce;
  const month: FinancialMonth = row
    ? {
        calendar: row.calendar as FinancialMonth['calendar'],
        key: row.monthKey,
        firstDate: row.firstDate,
        endDate: row.endDate,
      }
    : candidate;
  const calendar = await plantCloseCalendar(manager, tenantId, {
    from: month.endDate,
    weekendDays: policy.policy.weekendDays,
  });
  const deadlines = closeDeadlines(month, policy.policy, calendar.working);
  return {
    tenantId,
    month,
    policy,
    row,
    calendar,
    deadlines,
    dueAt: {
      quantities: endOfLocalDay(deadlines.quantitiesDue, calendar.timezone),
      finance: endOfLocalDay(deadlines.financeDue, calendar.timezone),
    },
  };
}
