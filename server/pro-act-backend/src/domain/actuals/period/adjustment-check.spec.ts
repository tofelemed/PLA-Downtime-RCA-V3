import { Dec, formatDec } from '../decimal';
import {
  AdjustmentDelta,
  adjustmentViolation,
  projectActuals,
  SliceActualsNow,
} from './adjustment-check';

const now = (
  gross: string | null,
  good: string | null,
  reject: string | null,
): SliceActualsNow => ({
  basis: gross === null && good !== null ? 'good' : 'gross',
  gross: gross === null ? null : new Dec(gross),
  good: good === null ? null : new Dec(good),
  reject: reject === null ? null : new Dec(reject),
});
const delta = (
  kind: AdjustmentDelta['kind'],
  quantity: string,
): AdjustmentDelta => ({
  kind,
  quantity: new Dec(quantity),
});
const fmt = (value: Dec | null) => (value === null ? null : formatDec(value));

describe('actuals adjustment projection and check', () => {
  it('gross basis: good follows gross, reject and rework deltas linearly', () => {
    const projected = projectActuals(now('100', '96', '4'), [
      delta('gross', '5'),
      delta('reject', '1'),
      delta('rework', '0.5'),
      delta('good', '-2'),
    ]);
    expect([
      fmt(projected.gross),
      fmt(projected.good),
      fmt(projected.reject),
    ]).toEqual(['105', '98.5', '5']);
    expect(adjustmentViolation(projected)).toBeNull();
  });

  it('good +5 on a slice with 4 t of rejects → good exceeds gross (negative quality loss)', () => {
    const violation = adjustmentViolation(
      projectActuals(now('100', '96', '4'), [delta('good', '5')]),
    );
    expect(violation).toMatchObject({
      code: 'ADJUSTMENT_GOOD_EXCEEDS_GROSS',
      details: { gross: '100', good: '101', reject: '4' },
    });
  });

  it('a reversal plus a re-booking on gross is possible', () => {
    const projected = projectActuals(now('100', '96', '4'), [
      delta('good', '5'),
      delta('good', '-5'),
      delta('gross', '5'),
    ]);
    expect(adjustmentViolation(projected)).toBeNull();
    expect(fmt(projected.good)).toBe('101');
  });

  it('refuses negative gross, good and rejects', () => {
    const base = now('10', '9', '1');
    expect(
      adjustmentViolation(projectActuals(base, [delta('gross', '-11')]))?.code,
    ).toBe('ADJUSTMENT_NEGATIVE_GROSS');
    expect(
      adjustmentViolation(projectActuals(base, [delta('good', '-10')]))?.code,
    ).toBe('ADJUSTMENT_NEGATIVE_GOOD');
    expect(
      adjustmentViolation(projectActuals(base, [delta('reject', '-2')]))?.code,
    ).toBe('ADJUSTMENT_NEGATIVE_REJECT');
  });

  it('good basis: gross stays unknown, so only negative good is refused', () => {
    const projected = projectActuals(now(null, '50', null), [
      delta('good', '20'),
      delta('gross', '5'),
    ]);
    expect([fmt(projected.gross), fmt(projected.good)]).toEqual([null, '70']);
    expect(adjustmentViolation(projected)).toBeNull();
  });

  it('no source yet: a gross adjustment becomes gross and good is derived from it', () => {
    const projected = projectActuals(now(null, null, null), [
      delta('gross', '30'),
      delta('reject', '2'),
    ]);
    expect([fmt(projected.gross), fmt(projected.good)]).toEqual(['30', '28']);
  });
});
