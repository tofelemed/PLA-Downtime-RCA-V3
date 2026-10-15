import { FINANCIAL_CALENDARS, FinancialCalendar } from './financial-month';
import {
  flag,
  integer,
  oneOf,
  positive,
  Raw,
  record,
  stringList,
  WorkflowPolicyError,
  weekdays,
} from './policy-fields';

/**
 * Materiality routing (SME R1): when the month's approved Unaccounted, bridge and tolerance adjustments of
 * one unit of measure reach the threshold, an extra reviewer signs before finance. Off by default.
 */
export interface MaterialityRule {
  enabled: boolean;
  /** unit of measure → quantity at or above which the month needs the extra review */
  thresholds: Record<string, number>;
  /** scope roles that may give the extra review */
  reviewerRoles: string[];
}

/** `month_close` body (contracts/policies/month_close.schema.json; SME R1 / R4 pilot settings). */
export interface MonthClosePolicy {
  financialCalendar: FinancialCalendar;
  /** ISO weekdays that are not working days (holidays come from the plant calendar) */
  weekendDays: number[];
  /** quantities closed by plant management by this working day after month end */
  quantitiesCloseWorkingDay: number;
  /** finance sign-off by this working day after month end */
  financeSignOffWorkingDay: number;
  /** an open change proposal of the month blocks the close until it is accepted or dismissed */
  blockOnOpenProposals: boolean;
  materiality: MaterialityRule;
}

export const MATERIALITY_OFF: MaterialityRule = {
  enabled: false,
  thresholds: {},
  reviewerRoles: ['production_accountant'],
};

/**
 * Pilot default (SME R4: quantities by working day 3, finance by working day 5). Iranian plants — time zone
 * Asia/Tehran or the Persian display calendar — close Solar Hijri months with a Thursday–Friday weekend;
 * every other plant Gregorian months with a Saturday–Sunday weekend. Seeds a plant's first version only.
 */
export function monthCloseDefault(plant: {
  timezone: string | null;
  calendarSystem: string | null;
}): MonthClosePolicy {
  const iranian =
    plant.timezone === 'Asia/Tehran' || plant.calendarSystem === 'persian';
  return {
    financialCalendar: iranian ? 'persian' : 'gregorian',
    weekendDays: iranian ? [4, 5] : [6, 7],
    quantitiesCloseWorkingDay: 3,
    financeSignOffWorkingDay: 5,
    blockOnOpenProposals: true,
    materiality: MATERIALITY_OFF,
  };
}

function materiality(raw: Raw): MaterialityRule {
  const thresholds = record(raw.thresholds, 'materiality.thresholds');
  return {
    enabled: flag(raw.enabled, 'materiality.enabled'),
    thresholds: Object.fromEntries(
      Object.entries(thresholds).map(([uom, quantity]) => [
        uom,
        positive(quantity, `materiality.thresholds.${uom}`),
      ]),
    ),
    reviewerRoles: stringList(raw.reviewerRoles, 'materiality.reviewerRoles'),
  };
}

export function parseMonthClosePolicy(body: unknown): MonthClosePolicy {
  const raw = record(body, 'month_close');
  const policy: MonthClosePolicy = {
    financialCalendar: oneOf(
      raw.financialCalendar,
      FINANCIAL_CALENDARS,
      'financialCalendar',
    ),
    weekendDays: weekdays(raw.weekendDays, 'weekendDays'),
    quantitiesCloseWorkingDay: integer(
      raw.quantitiesCloseWorkingDay,
      'quantitiesCloseWorkingDay',
      1,
    ),
    financeSignOffWorkingDay: integer(
      raw.financeSignOffWorkingDay,
      'financeSignOffWorkingDay',
      1,
    ),
    blockOnOpenProposals: flag(
      raw.blockOnOpenProposals,
      'blockOnOpenProposals',
    ),
    materiality: materiality(record(raw.materiality, 'materiality')),
  };
  if (policy.weekendDays.length === 7) {
    throw new WorkflowPolicyError('weekendDays leaves no working day');
  }
  if (policy.financeSignOffWorkingDay < policy.quantitiesCloseWorkingDay) {
    throw new WorkflowPolicyError(
      'finance signs off after quantities are closed',
    );
  }
  return policy;
}
