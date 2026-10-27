import {
  DECLARED_CONFIRMED_STATUS,
  declaredIdentityGap,
  DeclaredFigures,
  isDeclaredConfirmed,
  parseDeclaredFigures,
} from './declared-figures';

const FIGURES: DeclaredFigures = {
  planned: 120,
  actual: 112.5,
  shortfall: 7.5,
  uom: 't',
  measurementQuality: null,
  sourceStatus: null,
  plan: null,
  piSource: null,
};

describe('parseDeclaredFigures', () => {
  it('reads a complete value, with defaults for the optional parts', () => {
    expect(
      parseDeclaredFigures({
        planned: 120,
        actual: '112.5',
        shortfall: 7.5,
        sourceStatus: 'CONFIRMED',
        plan: { source: 'OT', planId: 'p-1', revision: 3, approved: true },
        piSource: { actualTag: 'tag', eventFrameId: 'ef-1' },
      }),
    ).toEqual({
      ...FIGURES,
      sourceStatus: 'CONFIRMED',
      plan: { source: 'OT', planId: 'p-1', revision: 3, approved: true },
      piSource: { actualTag: 'tag', eventFrameId: 'ef-1' },
    });
  });

  it('reads stored JSON text and keeps a given unit of measure', () => {
    expect(
      parseDeclaredFigures(JSON.stringify({ shortfall: 2, uom: 'kg' })),
    ).toEqual({
      ...FIGURES,
      planned: null,
      actual: null,
      shortfall: 2,
      uom: 'kg',
    });
  });

  it.each([
    null,
    undefined,
    5,
    [],
    'not json',
    {},
    { shortfall: 'x' },
    { shortfall: null },
  ])('is null for %p (no readable shortfall)', (raw) => {
    expect(parseDeclaredFigures(raw)).toBeNull();
  });
});

describe('declaredIdentityGap', () => {
  it('is planned - actual - shortfall', () => {
    expect(declaredIdentityGap(FIGURES)).toBe(0);
    expect(declaredIdentityGap({ ...FIGURES, shortfall: 5 })).toBe(2.5);
    expect(declaredIdentityGap({ ...FIGURES, shortfall: 10 })).toBe(-2.5);
  });

  it('has no binary float noise for non-dyadic decimals', () => {
    const gap = (planned: number, actual: number, shortfall: number) =>
      declaredIdentityGap({ ...FIGURES, planned, actual, shortfall });
    expect(gap(100.1, 90.05, 10.05)).toBe(0);
    expect(gap(1234.56, 1200.12, 34.44)).toBe(0);
  });

  it('is 0 when planned or actual is missing (nothing to check)', () => {
    expect(declaredIdentityGap({ ...FIGURES, planned: null })).toBe(0);
    expect(declaredIdentityGap({ ...FIGURES, actual: null })).toBe(0);
  });
});

describe('isDeclaredConfirmed', () => {
  it('is true only for the OT CONFIRMED status', () => {
    expect(isDeclaredConfirmed(null)).toBe(false);
    expect(isDeclaredConfirmed(FIGURES)).toBe(false);
    expect(
      isDeclaredConfirmed({
        ...FIGURES,
        sourceStatus: DECLARED_CONFIRMED_STATUS,
      }),
    ).toBe(true);
  });
});
