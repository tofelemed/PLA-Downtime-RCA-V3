import { parseLegacyPeriodLabel } from './period-label';

describe('parseLegacyPeriodLabel (§18.2 free-text periods)', () => {
  it('reads an ISO or slash calendar day as the plant-local operational date', () => {
    expect(parseLegacyPeriodLabel('2026-10-09')).toEqual({
      kind: 'day',
      localDate: '2026-10-09',
    });
    expect(parseLegacyPeriodLabel(' 2026/02/28 ')).toEqual({
      kind: 'day',
      localDate: '2026-02-28',
    });
  });

  it('reads an ISO instant with a zone as that instant in UTC', () => {
    expect(parseLegacyPeriodLabel('2026-10-09T06:30:00+03:30')).toEqual({
      kind: 'instant',
      at: '2026-10-09T03:00:00.000Z',
    });
  });

  it.each([
    ['', 'empty'],
    ['2026-02-30', 'invalid date'],
    ['2026-10', 'month (roll-up, no single period)'],
    ['2026-10-09T06:30', 'unrecognised format'],
    ['09/10/2026', 'unrecognised format'],
    ['Shift A', 'unrecognised format'],
  ])('leaves %p ambiguous (%s) instead of guessing', (label, reason) => {
    expect(parseLegacyPeriodLabel(label)).toEqual({
      kind: 'ambiguous',
      reason,
    });
  });

  it('treats null as empty', () => {
    expect(parseLegacyPeriodLabel(null)).toEqual({
      kind: 'ambiguous',
      reason: 'empty',
    });
  });
});
