import { OPEN_ENDED } from '../periods/period-recalc';
import { calendarRecalcRequest } from './calendar-recalc';

describe('calendarRecalcRequest (LA-03)', () => {
  const base = { tenantId: 't-1', unitIds: ['u-1', 'u-2'], actorId: 'user-1' };

  it('a republish that regenerates past dates recalculates the units from two days before that date, future periods included', () => {
    expect(
      calendarRecalcRequest({ ...base, regenerateFrom: '2027-03-10' }),
    ).toEqual({
      tenantId: 't-1',
      unitIds: ['u-1', 'u-2'],
      from: new Date('2027-03-08T00:00:00.000Z'),
      to: OPEN_ENDED,
      reason: 'calendar_republished',
      scopeUnitIds: null,
      requestedBy: 'user-1',
    });
  });

  it('a publish that only adds future or missing dates needs no recalculation', () => {
    expect(
      calendarRecalcRequest({ ...base, regenerateFrom: undefined }),
    ).toBeNull();
    expect(
      calendarRecalcRequest({
        ...base,
        unitIds: [],
        regenerateFrom: '2027-03-10',
      }),
    ).toBeNull();
  });
});
