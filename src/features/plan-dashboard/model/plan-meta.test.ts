import { describe, expect, it } from 'vitest';
import { planMetaText } from './plan-meta';

describe('planMetaText', () => {
  it('joins the unit name and the version', () => {
    expect(planMetaText('Extruder 1', 3)).toBe('Extruder 1 · Version 3');
  });

  it('has no leading separator when the unit name is empty', () => {
    expect(planMetaText('', 3)).toBe('Version 3');
    expect(planMetaText('  ', 3)).toBe('Version 3');
  });
});
