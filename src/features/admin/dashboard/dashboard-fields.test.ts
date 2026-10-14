import { describe, expect, it } from 'vitest';
import { DASHBOARD_GROUP_KEYS, DASHBOARD_GROUPS } from './dashboard-fields';

const RETIRED = ['availabilityWeight', 'performanceWeight', 'qualityWeight', 'lossValuePerUnit', 'defaultUnaccountedLossPercentage'];

describe('dashboard settings fields', () => {
  it('no longer offers the v1 constants nothing reads (FE-02)', () => {
    const keys = DASHBOARD_GROUP_KEYS.flatMap((group) => DASHBOARD_GROUPS[group].fields.map((field) => field.key));
    expect(keys.filter((key) => RETIRED.includes(key))).toEqual([]);
    expect(keys).toContain('targetOEE');
  });
});
