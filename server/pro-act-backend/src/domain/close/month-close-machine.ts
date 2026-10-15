import { FinancialMonth } from './financial-month';
import { MonthClosePolicy } from './month-close-policy';
import { nthWorkingDay, WorkingCalendar } from './working-days';

/**
 * Month close states (SME R1 / R4): `open` while periods are reconciled; `quantities_closed` once plant
 * management signed the month's quantities; `finance_signed_off` once finance signed; `locked` — approved
 * periods of the month then change only through a change proposal accepted "after close".
 */
export const MONTH_CLOSE_STATES = [
  'open',
  'quantities_closed',
  'finance_signed_off',
  'locked',
] as const;
export type MonthCloseState = (typeof MONTH_CLOSE_STATES)[number];

export const MONTH_CLOSE_ACTIONS = [
  'close_quantities',
  'review_materiality',
  'sign_off_finance',
  'lock',
  'reopen',
] as const;
export type MonthCloseAction = (typeof MONTH_CLOSE_ACTIONS)[number];

/** The sign-offs a month already carries. */
export interface MonthCloseParties {
  state: MonthCloseState;
  quantitiesClosedBy: string | null;
  financeSignedOffBy: string | null;
  materialityRequired: boolean;
  materialityReviewedBy: string | null;
}

export type MonthCloseRefusal =
  | 'INVALID_TRANSITION'
  | 'CLOSE_PREREQUISITES'
  | 'SEPARATION_OF_DUTIES'
  | 'MATERIALITY_REVIEW_REQUIRED'
  | 'MATERIALITY_REVIEW_NOT_REQUIRED';

export type MonthCloseDecision =
  | { ok: true; to: MonthCloseState }
  | { ok: false; refusal: MonthCloseRefusal };

const FROM: Readonly<Record<MonthCloseAction, readonly MonthCloseState[]>> = {
  close_quantities: ['open'],
  review_materiality: ['quantities_closed'],
  sign_off_finance: ['quantities_closed'],
  lock: ['finance_signed_off'],
  reopen: ['quantities_closed', 'finance_signed_off'],
};

const TO: Readonly<Record<MonthCloseAction, MonthCloseState | null>> = {
  close_quantities: 'quantities_closed',
  review_materiality: null,
  sign_off_finance: 'finance_signed_off',
  lock: 'locked',
  reopen: 'open',
};

const refuse = (refusal: MonthCloseRefusal): MonthCloseDecision => ({
  ok: false,
  refusal,
});

/** Separation of duties and the materiality step of one action (null = allowed). */
function partyRefusal(
  action: MonthCloseAction,
  parties: MonthCloseParties,
  actor: string,
): MonthCloseRefusal | null {
  if (action === 'review_materiality') {
    if (!parties.materialityRequired) return 'MATERIALITY_REVIEW_NOT_REQUIRED';
    if (parties.materialityReviewedBy) return 'INVALID_TRANSITION';
    if (parties.quantitiesClosedBy === actor) return 'SEPARATION_OF_DUTIES';
  }
  if (action === 'sign_off_finance') {
    if (parties.quantitiesClosedBy === actor) return 'SEPARATION_OF_DUTIES';
    if (parties.materialityReviewedBy === actor) return 'SEPARATION_OF_DUTIES';
    if (parties.materialityRequired && !parties.materialityReviewedBy)
      return 'MATERIALITY_REVIEW_REQUIRED';
  }
  return null;
}

/**
 * Whether `actor` may take `action` on a month with these sign-offs. Closing and locking need the
 * prerequisites (`blocked` = some period not approved / certified or an open change proposal); finance
 * never signs a month whose quantities it closed or whose materiality it reviewed (SME R1, segregation).
 */
export function decideMonthClose(
  action: MonthCloseAction,
  parties: MonthCloseParties,
  input: { actor: string; blocked: boolean },
): MonthCloseDecision {
  if (!FROM[action].includes(parties.state))
    return refuse('INVALID_TRANSITION');
  const party = partyRefusal(action, parties, input.actor);
  if (party) return refuse(party);
  const needsPrerequisites =
    action === 'close_quantities' ||
    action === 'sign_off_finance' ||
    action === 'lock';
  if (needsPrerequisites && input.blocked) return refuse('CLOSE_PREREQUISITES');
  return { ok: true, to: TO[action] ?? parties.state };
}

/** The working-day deadlines of a month (SME R4): local dates of the plant. */
export interface CloseDeadlines {
  quantitiesDue: string;
  financeDue: string;
}

export function closeDeadlines(
  month: FinancialMonth,
  policy: Pick<
    MonthClosePolicy,
    'quantitiesCloseWorkingDay' | 'financeSignOffWorkingDay'
  >,
  calendar: WorkingCalendar,
): CloseDeadlines {
  return {
    quantitiesDue: nthWorkingDay(
      month.endDate,
      policy.quantitiesCloseWorkingDay,
      calendar,
    ),
    financeDue: nthWorkingDay(
      month.endDate,
      policy.financeSignOffWorkingDay,
      calendar,
    ),
  };
}

/** Which deadline a month in `state` has missed at `now` (instants: the end of the due local day). */
export function overdueStages(
  state: MonthCloseState,
  dueAt: { quantities: Date; finance: Date },
  now: Date,
): { quantitiesOverdue: boolean; financeOverdue: boolean } {
  return {
    quantitiesOverdue: state === 'open' && now >= dueAt.quantities,
    financeOverdue:
      (state === 'open' || state === 'quantities_closed') &&
      now >= dueAt.finance,
  };
}
