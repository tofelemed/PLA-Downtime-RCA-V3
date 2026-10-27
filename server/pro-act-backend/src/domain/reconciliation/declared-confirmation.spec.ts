import { isDeclaredConfirmed } from './declared-confirmation';

describe('isDeclaredConfirmed (D8)', () => {
  it('a feed event is confirmed only by the CONFIRMED status', () => {
    expect(isDeclaredConfirmed('mqtt', 'CONFIRMED')).toBe(true);
    expect(isDeclaredConfirmed('mqtt', 'DETECTED')).toBe(false);
    expect(isDeclaredConfirmed('mqtt', null)).toBe(false);
  });

  it('a manual event is confirmed unless it states another status', () => {
    expect(isDeclaredConfirmed('manual', null)).toBe(true);
    expect(isDeclaredConfirmed('manual', 'CONFIRMED')).toBe(true);
    expect(isDeclaredConfirmed('manual', 'DETECTED')).toBe(false);
  });
});
