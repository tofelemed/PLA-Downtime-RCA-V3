import { afterEach, describe, expect, it } from 'vitest';
import { plural, setPluralDigits } from './plural';

describe('counts in sentences follow the plant digits (settings audit, 21 Oct 2026)', () => {
  afterEach(() => setPluralDigits('latin'));

  it('uses the digits the plant settings provider set, unless a formatter is passed', () => {
    expect(plural(1200, 'stop', 'stops')).toBe('1,200 stops');
    setPluralDigits('persian');
    expect(plural(3, 'stop', 'stops')).toBe('۳ stops');
    expect(plural(1, 'stop', 'stops', (n) => `#${n}`)).toBe('#1 stop');
  });
});
