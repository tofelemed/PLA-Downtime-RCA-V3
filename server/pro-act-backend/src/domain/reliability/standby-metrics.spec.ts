import { StandbyLogEntry, standbyMetrics } from './standby-metrics';

const H = 3_600_000;
const T0 = Date.UTC(2026, 0, 1);
const t = (ms: number) => new Date(T0 + ms);
const YEAR = { start: t(0), end: t(8760 * H) };

describe('standby equipment measures (SME D9)', () => {
  it('worked example: 20 demands, 1 failed start, 50 running hours → 5 % on demand, no MTBF', () => {
    const log: StandbyLogEntry[] = [];
    for (let i = 0; i < 20; i += 1) {
      const start = t((i * 400 + 10) * H);
      log.push({
        kind: 'demand',
        start,
        end: null,
        outcome: i === 7 ? 'failed_start' : 'success',
      });
      if (i !== 7 && i < 10)
        log.push({
          kind: 'run',
          start,
          end: new Date(start.getTime() + 5 * H),
          outcome: 'success',
        });
    }
    log.push({
      kind: 'test',
      start: t(100 * H),
      end: null,
      outcome: 'success',
    });
    const metrics = standbyMetrics(log, YEAR, {
      asOf: YEAR.end,
      registered: [YEAR],
    });
    expect(metrics.demands).toBe(20);
    expect(metrics.failureOnDemand).toEqual({
      numerator: 1,
      denominator: 20,
      value: 0.05,
      reason: null,
    });
    expect(metrics.tests).toBe(1);
    expect(metrics.testFailureFraction.value).toBe(0);
    expect(metrics.runningSeconds).toBe(45 * 3600);
    expect(metrics.operatingMtbf).toEqual({
      numerator: 45 * 3600,
      denominator: 0,
      value: null,
      reason: 'no_failures',
    });
    expect(metrics.standbySeconds).toBe((8760 - 45) * 3600);
  });

  it('a failure while running gives an operating MTBF on the asset’s own running hours', () => {
    const log: StandbyLogEntry[] = [
      {
        kind: 'run',
        start: t(0),
        end: t(30 * H),
        outcome: 'failed_while_running',
      },
      { kind: 'run', start: t(40 * H), end: null, outcome: 'success' },
    ];
    const metrics = standbyMetrics(
      log,
      { start: t(0), end: t(100 * H) },
      { asOf: t(60 * H), registered: [] },
    );
    expect(metrics.runningSeconds).toBe(50 * 3600);
    expect(metrics.operatingMtbf.value).toBe(50 * 3600);
  });

  it('no demands: no failure-on-demand ratio, with a reason', () => {
    const metrics = standbyMetrics([], YEAR, {
      asOf: YEAR.end,
      registered: [],
    });
    expect(metrics.failureOnDemand).toMatchObject({
      value: null,
      reason: 'no_demands',
    });
    expect(metrics.operatingMtbf.reason).toBe('no_running_exposure');
  });
});
