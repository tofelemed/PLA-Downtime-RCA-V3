import {
  certifyRefusal,
  DayPeriod,
  dayRollup,
  dayState,
} from './day-certification';

const shift = (over: Partial<DayPeriod> = {}): DayPeriod => ({
  periodId: 'p',
  isExcluded: false,
  workflow: 'approved',
  submittedBy: 'preparer',
  ...over,
});

describe('day certification over the shift periods (SME R2, owner decision 14 Oct)', () => {
  it('a day is ready when every shift that needs it is approved; an excluded, never reconciled shift needs none', () => {
    expect(dayState([shift(), shift(), shift()], false)).toBe('ready');
    expect(dayState([shift(), shift({ workflow: 'in_review' })], false)).toBe(
      'open',
    );
    expect(
      dayState([shift(), shift({ isExcluded: true, workflow: 'none' })], false),
    ).toBe('ready');
    expect(dayState([], false)).toBe('open');
    expect(dayState([shift()], true)).toBe('certified');
  });

  it('the certifier submitted none of the shifts; the day is ready and not certified yet', () => {
    const day = [shift({ submittedBy: 'a' }), shift({ submittedBy: 'b' })];
    expect(certifyRefusal('manager', day, false)).toBeNull();
    expect(certifyRefusal('b', day, false)).toBe('SEPARATION_OF_DUTIES');
    expect(certifyRefusal('manager', day, true)).toBe('DAY_CERTIFIED');
    expect(
      certifyRefusal('manager', [...day, shift({ workflow: 'draft' })], false),
    ).toBe('DAY_NOT_READY');
  });

  it('worked example: shifts of 100, 110 and 90 t make a 300 t day — summed once, per unit of measure', () => {
    const figures = (actual: string, uom = 't') => ({
      uom,
      target: '100',
      actual,
      gap: '0',
      attributed: '0',
      residual: '0',
    });
    expect(
      dayRollup([
        figures('100'),
        figures('110'),
        figures('90'),
        figures('5', 'm3'),
      ]),
    ).toEqual([
      {
        uom: 'm3',
        periods: 1,
        target: '100',
        actual: '5',
        gap: '0',
        attributed: '0',
        residual: '0',
      },
      {
        uom: 't',
        periods: 3,
        target: '300',
        actual: '300',
        gap: '0',
        attributed: '0',
        residual: '0',
      },
    ]);
    expect(
      dayRollup([figures('100'), { ...figures('1'), actual: null }])[0].actual,
    ).toBeNull();
  });
});
