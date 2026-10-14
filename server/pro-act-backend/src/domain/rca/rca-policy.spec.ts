import * as fs from 'fs';
import * as path from 'path';
import {
  assertCostCurrency,
  parseRcaPolicy,
  RCA_POLICY_DEFAULT,
  RcaPolicyError,
} from './rca-policy';
import { RCA_RULES_DEFAULT } from './rca-policy-rules';

const LEGACY = {
  durationThresholdSeconds: 3600,
  costThreshold: null,
  repeatCount: 3,
  repeatWindowDays: 30,
  autoCreate: 'recommend',
};

describe('parseRcaPolicy (D13 + SME D17 / CA2–CA8)', () => {
  it('the seed default file is the D17 pilot and parses to RCA_POLICY_DEFAULT', () => {
    const file = path.resolve(
      __dirname,
      '../../../../../contracts/policies/defaults/rca_policy.default.json',
    );
    const seed = JSON.parse(fs.readFileSync(file, 'utf8')) as { body: unknown };
    expect(parseRcaPolicy(seed.body)).toEqual(RCA_POLICY_DEFAULT);
    expect(RCA_POLICY_DEFAULT).toMatchObject({
      durationThresholdSeconds: 7200,
      lostQuantityShareOfDailyPlan: 0.01,
      repeatCount: 3,
      repeatWindowDays: 30,
      criticalAssets: { thresholdFactor: 0.5 },
      costThreshold: null,
    });
  });

  it('a D13 version keeps its behaviour: per-asset repeats, no quantity / cumulative / override', () => {
    expect(parseRcaPolicy(LEGACY)).toEqual({
      ...LEGACY,
      costCurrency: null,
      lostQuantityShareOfDailyPlan: null,
      repeatMatch: 'asset',
      criticalAssets: { criticalities: [], thresholdFactor: 1 },
      cumulative: null,
      consequence: { solTypes: [], severities: [] },
      ...RCA_RULES_DEFAULT,
    });
  });

  it('a money limit needs its currency (finance sets both); a D13 threshold without one stays inert', () => {
    const legacy = parseRcaPolicy({ ...LEGACY, costThreshold: 5000 });
    expect(legacy.costCurrency).toBeNull();
    expect(() => assertCostCurrency(legacy)).toThrow(RcaPolicyError);
    expect(
      parseRcaPolicy({ ...LEGACY, costThreshold: 5000, costCurrency: 'USD' })
        .costCurrency,
    ).toBe('USD');
  });

  it('a malformed section is an error, never a silent default', () => {
    expect(() => parseRcaPolicy({ ...LEGACY, repeatMatch: 'unit' })).toThrow(
      RcaPolicyError,
    );
    expect(() =>
      parseRcaPolicy({
        ...LEGACY,
        criticalAssets: { criticalities: ['A'], thresholdFactor: 2 },
      }),
    ).toThrow(RcaPolicyError);
    expect(() =>
      parseRcaPolicy({
        ...LEGACY,
        fmea: { ...RCA_RULES_DEFAULT.fmea, severityReview: 11 },
      }),
    ).toThrow(RcaPolicyError);
    expect(() =>
      parseRcaPolicy({
        ...LEGACY,
        investigation: {
          ...RCA_RULES_DEFAULT.investigation,
          minor: { methodGroups: [['x']], minTeamMembers: 0 },
        },
      }),
    ).toThrow(RcaPolicyError);
  });

  it('criticalities compare case-insensitively', () => {
    const policy = parseRcaPolicy({
      ...LEGACY,
      criticalAssets: {
        criticalities: [' Critical ', 'A'],
        thresholdFactor: 0.5,
      },
    });
    expect(policy.criticalAssets.criticalities).toEqual(['critical', 'a']);
  });
});
