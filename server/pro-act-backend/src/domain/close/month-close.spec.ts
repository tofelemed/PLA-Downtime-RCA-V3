import {
  financialMonth,
  isMonthKey,
  monthOfDate,
  previousMonth,
} from './financial-month';
import { materialityFindings, MATERIAL_KINDS } from './materiality';
import {
  closeDeadlines,
  decideMonthClose,
  MonthCloseParties,
  overdueStages,
} from './month-close-machine';
import {
  MATERIALITY_OFF,
  monthCloseDefault,
  parseMonthClosePolicy,
} from './month-close-policy';
import { WorkflowPolicyError } from './policy-fields';
import { isWorkingDay, nthWorkingDay } from './working-days';

const satSun = { weekendDays: [6, 7], holidays: new Set<string>() };
const thuFri = { weekendDays: [4, 5], holidays: new Set<string>() };

describe('financial months (SME R4)', () => {
  it('Gregorian months are calendar months, December rolls over', () => {
    expect(financialMonth('2026-10', 'gregorian')).toEqual({
      calendar: 'gregorian',
      key: '2026-10',
      firstDate: '2026-10-01',
      endDate: '2026-11-01',
    });
    expect(financialMonth('2026-12', 'gregorian').endDate).toBe('2027-01-01');
    expect(monthOfDate('2026-10-31', 'gregorian').key).toBe('2026-10');
  });

  it('Solar Hijri months: Mehr 1405 is 23 Sep – 22 Oct 2026, Esfand 1405 has 29 days', () => {
    expect(financialMonth('1405-07', 'persian')).toMatchObject({
      firstDate: '2026-09-23',
      endDate: '2026-10-23',
    });
    expect(financialMonth('1405-12', 'persian')).toMatchObject({
      firstDate: '2027-02-20',
      endDate: '2027-03-21',
    });
    expect(monthOfDate('2027-03-01', 'persian').key).toBe('1405-12');
    expect(monthOfDate('2027-03-21', 'persian').key).toBe('1406-01');
    expect(previousMonth(financialMonth('1406-01', 'persian')).key).toBe(
      '1405-12',
    );
  });

  it('refuses malformed month keys', () => {
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-1')).toBe(false);
    expect(() => financialMonth('2026-00', 'gregorian')).toThrow(RangeError);
  });
});

describe('working days of the close calendar (SME R4)', () => {
  it('working day 3 and 5 after a Gregorian month end, Saturday–Sunday weekend', () => {
    const month = financialMonth('2026-10', 'gregorian');
    expect(
      closeDeadlines(
        month,
        { quantitiesCloseWorkingDay: 3, financeSignOffWorkingDay: 5 },
        satSun,
      ),
    ).toEqual({ quantitiesDue: '2026-11-04', financeDue: '2026-11-06' });
  });

  it('a holiday right after month end is skipped, not counted (worked example)', () => {
    const calendar = { weekendDays: [6, 7], holidays: new Set(['2026-11-02']) };
    expect(nthWorkingDay('2026-11-01', 3, calendar)).toBe('2026-11-05');
    expect(nthWorkingDay('2026-11-01', 5, calendar)).toBe('2026-11-09');
    expect(isWorkingDay('2026-11-02', calendar)).toBe(false);
  });

  it('Iranian plant: Mehr 1405 ends on a Friday, the Thursday–Friday weekend is skipped', () => {
    const month = financialMonth('1405-07', 'persian');
    expect(
      closeDeadlines(
        month,
        { quantitiesCloseWorkingDay: 3, financeSignOffWorkingDay: 5 },
        thuFri,
      ),
    ).toEqual({ quantitiesDue: '2026-10-26', financeDue: '2026-10-28' });
  });

  it('refuses working day 0 and a calendar without working days', () => {
    expect(() => nthWorkingDay('2026-11-01', 0, satSun)).toThrow(RangeError);
    const never = {
      weekendDays: [1, 2, 3, 4, 5, 6, 7],
      holidays: new Set<string>(),
    };
    expect(() => nthWorkingDay('2026-11-01', 1, never)).toThrow(RangeError);
  });
});

describe('month close transitions (SME R1 / R4)', () => {
  const open: MonthCloseParties = {
    state: 'open',
    quantitiesClosedBy: null,
    financeSignedOffBy: null,
    materialityRequired: false,
    materialityReviewedBy: null,
  };
  const closed: MonthCloseParties = {
    ...open,
    state: 'quantities_closed',
    quantitiesClosedBy: 'plant-manager',
  };

  it('open → quantities closed → finance signed off → locked', () => {
    expect(
      decideMonthClose('close_quantities', open, {
        actor: 'plant-manager',
        blocked: false,
      }),
    ).toEqual({ ok: true, to: 'quantities_closed' });
    expect(
      decideMonthClose('sign_off_finance', closed, {
        actor: 'finance',
        blocked: false,
      }),
    ).toEqual({ ok: true, to: 'finance_signed_off' });
    expect(
      decideMonthClose(
        'lock',
        {
          ...closed,
          state: 'finance_signed_off',
          financeSignedOffBy: 'finance',
        },
        { actor: 'finance', blocked: false },
      ),
    ).toEqual({ ok: true, to: 'locked' });
  });

  it('prerequisites block closing, signing and locking', () => {
    expect(
      decideMonthClose('close_quantities', open, { actor: 'm', blocked: true }),
    ).toEqual({ ok: false, refusal: 'CLOSE_PREREQUISITES' });
    expect(
      decideMonthClose('sign_off_finance', closed, {
        actor: 'finance',
        blocked: true,
      }),
    ).toEqual({ ok: false, refusal: 'CLOSE_PREREQUISITES' });
  });

  it('finance never signs a month whose quantities it closed (segregation of duties)', () => {
    expect(
      decideMonthClose('sign_off_finance', closed, {
        actor: 'plant-manager',
        blocked: false,
      }),
    ).toEqual({ ok: false, refusal: 'SEPARATION_OF_DUTIES' });
  });

  it('materiality: the extra review comes first, by someone other than both signers', () => {
    const material = { ...closed, materialityRequired: true };
    expect(
      decideMonthClose('sign_off_finance', material, {
        actor: 'finance',
        blocked: false,
      }),
    ).toEqual({ ok: false, refusal: 'MATERIALITY_REVIEW_REQUIRED' });
    expect(
      decideMonthClose('review_materiality', material, {
        actor: 'plant-manager',
        blocked: false,
      }),
    ).toEqual({ ok: false, refusal: 'SEPARATION_OF_DUTIES' });
    expect(
      decideMonthClose('review_materiality', material, {
        actor: 'accountant',
        blocked: true,
      }),
    ).toEqual({ ok: true, to: 'quantities_closed' });
    const reviewed = { ...material, materialityReviewedBy: 'accountant' };
    expect(
      decideMonthClose('sign_off_finance', reviewed, {
        actor: 'accountant',
        blocked: false,
      }),
    ).toEqual({ ok: false, refusal: 'SEPARATION_OF_DUTIES' });
    expect(
      decideMonthClose('review_materiality', closed, {
        actor: 'accountant',
        blocked: false,
      }),
    ).toEqual({ ok: false, refusal: 'MATERIALITY_REVIEW_NOT_REQUIRED' });
  });

  it('a locked month is never reopened; a closing one is', () => {
    expect(
      decideMonthClose(
        'reopen',
        { ...closed, state: 'locked' },
        { actor: 'm', blocked: false },
      ),
    ).toEqual({ ok: false, refusal: 'INVALID_TRANSITION' });
    expect(
      decideMonthClose('reopen', closed, { actor: 'm', blocked: true }),
    ).toEqual({ ok: true, to: 'open' });
  });

  it('overdue per stage at the end of the due day', () => {
    const dueAt = {
      quantities: new Date('2026-11-04T23:00:00Z'),
      finance: new Date('2026-11-06T23:00:00Z'),
    };
    expect(
      overdueStages('open', dueAt, new Date('2026-11-05T00:00:00Z')),
    ).toEqual({ quantitiesOverdue: true, financeOverdue: false });
    expect(
      overdueStages(
        'quantities_closed',
        dueAt,
        new Date('2026-11-07T00:00:00Z'),
      ),
    ).toEqual({ quantitiesOverdue: false, financeOverdue: true });
    expect(
      overdueStages('locked', dueAt, new Date('2026-12-01T00:00:00Z')),
    ).toEqual({ quantitiesOverdue: false, financeOverdue: false });
  });
});

describe('month close policy and materiality', () => {
  it('pilot defaults: Iranian plants close Solar Hijri months, Thursday–Friday weekend', () => {
    expect(
      monthCloseDefault({ timezone: 'Asia/Tehran', calendarSystem: null }),
    ).toMatchObject({
      financialCalendar: 'persian',
      weekendDays: [4, 5],
      quantitiesCloseWorkingDay: 3,
      financeSignOffWorkingDay: 5,
      materiality: { enabled: false },
    });
    const other = monthCloseDefault({
      timezone: 'Europe/Berlin',
      calendarSystem: 'gregorian',
    });
    expect(other).toMatchObject({
      financialCalendar: 'gregorian',
      weekendDays: [6, 7],
    });
    expect(parseMonthClosePolicy(other)).toEqual(other);
  });

  it('refuses malformed bodies instead of guessing', () => {
    const base = monthCloseDefault({ timezone: null, calendarSystem: null });
    expect(() =>
      parseMonthClosePolicy({ ...base, weekendDays: [1, 2, 3, 4, 5, 6, 7] }),
    ).toThrow(WorkflowPolicyError);
    expect(() =>
      parseMonthClosePolicy({
        ...base,
        quantitiesCloseWorkingDay: 6,
        financeSignOffWorkingDay: 5,
      }),
    ).toThrow(WorkflowPolicyError);
    expect(() =>
      parseMonthClosePolicy({ ...base, financialCalendar: 'lunar' }),
    ).toThrow(WorkflowPolicyError);
  });

  it('routes a month whose adjustments of one unit reach the threshold; units never mix', () => {
    const rule = {
      enabled: true,
      thresholds: { t: 200 },
      reviewerRoles: ['production_accountant'],
    };
    expect(
      materialityFindings(
        [
          { uom: 't', quantity: '-200' },
          { uom: 'm3', quantity: '5000' },
        ],
        rule,
      ),
    ).toEqual([{ uom: 't', quantity: '200', threshold: '200' }]);
    expect(
      materialityFindings([{ uom: 't', quantity: '199.9' }], rule),
    ).toEqual([]);
    expect(
      materialityFindings([{ uom: 't', quantity: '900' }], MATERIALITY_OFF),
    ).toEqual([]);
    expect(MATERIAL_KINDS).toContain('bridge');
  });
});
