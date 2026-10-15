import { describe, expect, it } from 'vitest';
import type { StandbyMetricsView } from '@/api/v2/types/reliability';
import { fractionText, mtbfText, type MetricFormat } from './standby-metrics-model';

const FORMAT: MetricFormat = {
  number: (v) => String(v),
  percent: (v, digits) => `${v.toFixed(digits)} %`,
  duration: (s) => `${s / 3600} h`,
};

const metrics = (patch: Partial<StandbyMetricsView>): StandbyMetricsView => ({
  assetId: 'a1', unitId: 'u1', evaluation: 'demand_and_running',
  demands: 20, failedStarts: 1, failureOnDemand: { numerator: 1, denominator: 20, value: 0.05, reason: null },
  tests: 0, failedTests: 0, testFailureFraction: { numerator: 0, denominator: 0, value: null, reason: 'no_tests' },
  runningSeconds: 50 * 3600, failuresWhileRunning: 0, operatingMtbf: { numerator: 50 * 3600, denominator: 0, value: null, reason: 'no_failures' },
  standbySeconds: 8710 * 3600,
  ...patch,
});

describe('standby measures as text (SME D9)', () => {
  it('failure on demand names its counts; tests stay separate', () => {
    const m = metrics({});
    expect(fractionText(m.failureOnDemand, FORMAT)).toBe('5.0 % (1 of 20)');
    expect(fractionText(m.testFailureFraction, FORMAT)).toBe('No tests');
  });

  it('operating MTBF without a failure shows the exposure, never "infinite"', () => {
    expect(mtbfText(metrics({}), FORMAT)).toBe('No failures — exposure 50 h');
    const failed = metrics({ failuresWhileRunning: 2, operatingMtbf: { numerator: 50 * 3600, denominator: 2, value: 25 * 3600, reason: null } });
    expect(mtbfText(failed, FORMAT)).toBe('25 h');
    const idle = metrics({ runningSeconds: 0, operatingMtbf: { numerator: 0, denominator: 0, value: null, reason: 'no_running_exposure' } });
    expect(mtbfText(idle, FORMAT)).toBe('No running time');
    expect(mtbfText(idle, FORMAT)).not.toMatch(/infinit|∞/i);
  });
});
