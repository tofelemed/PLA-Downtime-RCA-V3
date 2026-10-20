import { RateKind } from './profile.types';
import { CapacityRate, capacityGaps } from './capacity-gap';

const t = (rate: string, timebase: CapacityRate['timebase'] = 'h') => ({
  rate,
  timebase,
  uom: 't',
});

describe('capacity gap (plan 1.2, D-T1)', () => {
  it('reports each step as upper − lower with its share of the upper rate', () => {
    const { gaps } = capacityGaps({
      nameplate: t('150'),
      demonstrated: t('132'),
      sustained: t('120'),
      planning: t('110'),
    });
    expect(gaps).toEqual([
      {
        upper: 'nameplate',
        lower: 'demonstrated',
        gap: '18',
        ratio: '0.12',
        reason: null,
      },
      {
        upper: 'demonstrated',
        lower: 'sustained',
        gap: '12',
        ratio: '0.09090909',
        reason: null,
      },
      {
        upper: 'sustained',
        lower: 'planning',
        gap: '10',
        ratio: '0.08333333',
        reason: null,
      },
    ]);
  });

  it('gives the utilisation ratios sustained / nameplate and planning / sustained', () => {
    const { ratios } = capacityGaps({
      nameplate: t('150'),
      sustained: t('120'),
      planning: t('110'),
    });
    expect(ratios).toEqual([
      {
        numerator: 'sustained',
        denominator: 'nameplate',
        ratio: '0.8',
        reason: null,
      },
      {
        numerator: 'planning',
        denominator: 'sustained',
        ratio: '0.91666667',
        reason: null,
      },
    ]);
  });

  it('infers nothing for a missing kind: the steps touching it are not_set', () => {
    const { gaps, ratios } = capacityGaps({
      nameplate: t('150'),
      sustained: t('120'),
    });
    expect(gaps.map((g) => [g.gap, g.reason])).toEqual([
      [null, 'not_set'],
      [null, 'not_set'],
      [null, 'not_set'],
    ]);
    expect(ratios.map((r) => [r.ratio, r.reason])).toEqual([
      ['0.8', null],
      [null, 'not_set'],
    ]);
    expect(capacityGaps({}).gaps.every((g) => g.reason === 'not_set')).toBe(
      true,
    );
  });

  it('never converts units of measure or timebases', () => {
    const rates: Partial<Record<RateKind, CapacityRate>> = {
      nameplate: { rate: '3600', timebase: 'd', uom: 't' },
      demonstrated: t('140'),
      sustained: { rate: '130', timebase: 'h', uom: 'kg' },
    };
    const { gaps, ratios } = capacityGaps(rates);
    expect(gaps[0]).toMatchObject({ gap: null, reason: 'timebase_mismatch' });
    expect(gaps[1]).toMatchObject({ gap: null, reason: 'uom_mismatch' });
    expect(ratios[0]).toMatchObject({ ratio: null, reason: 'uom_mismatch' });
  });

  it('keeps a negative gap when the lower kind is higher (never clamped)', () => {
    const [step] = capacityGaps({
      nameplate: t('100'),
      demonstrated: t('104.5'),
    }).gaps;
    expect(step).toMatchObject({ gap: '-4.5', ratio: '-0.045' });
  });

  it('computes in decimal: no binary floating-point drift at the stored scale', () => {
    const { gaps, ratios } = capacityGaps({
      nameplate: t('0.3'),
      demonstrated: t('0.1'),
      sustained: t('0.1'),
      planning: t('0.00000001'),
    });
    expect(gaps[0].gap).toBe('0.2');
    expect(gaps[1].gap).toBe('0');
    expect(gaps[2].gap).toBe('0.09999999');
    expect(ratios[1].ratio).toBe('0.0000001');
    const big = capacityGaps({
      nameplate: t('9999999999999999.99999999'),
      demonstrated: t('0.00000001'),
    }).gaps[0];
    expect(big.gap).toBe('9999999999999999.99999998');
  });

  it('has no ratio over a zero base', () => {
    const { gaps, ratios } = capacityGaps({
      nameplate: t('0'),
      demonstrated: t('0'),
      sustained: t('0'),
      planning: t('5'),
    });
    expect(gaps[0]).toMatchObject({ gap: '0', ratio: null, reason: null });
    expect(ratios).toEqual([
      expect.objectContaining({ ratio: null, reason: 'zero_base' }),
      expect.objectContaining({ ratio: null, reason: 'zero_base' }),
    ]);
  });
});
