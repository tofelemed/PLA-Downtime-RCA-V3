import { onTimeRate } from './rca-action-tracker';

describe('RCA action tracker (R10)', () => {
  it('on-time rate is on-time / actions with a due date; none without due dates', () => {
    expect(onTimeRate(3, 4)).toBe('0.75');
    expect(onTimeRate(2, 3)).toBe('0.6667');
    expect(onTimeRate(4, 4)).toBe('1');
    expect(onTimeRate(0, 0)).toBeNull();
  });
});
