import { Dec } from '../../src/domain/actuals/decimal';
import { KpiDraft } from '../../src/domain/kpi/kpi.types';
import {
  FailureSpan,
  reliability,
  ReliabilityInput,
} from '../../src/domain/kpi/reliability';

/**
 * SME D5 / S3 (KPI engine 2.7.8): repeat stops of one incident (same asset and mode within the merge
 * window) count once in MTBF, at the incident's start; every stop keeps its own duration in the mean
 * time to restore. An incident that started in an earlier window is not counted again.
 */
const T0 = Date.parse('2027-03-03T10:00:00Z');
const MIN = 60;
const at = (seconds: number) => new Date(T0 + seconds * 1000);

const failure = (
  id: string,
  from: number,
  to: number,
  incident: FailureSpan['incident'] = null,
): FailureSpan => ({
  occurrenceId: id,
  assetId: 'conveyor',
  start: at(from),
  end: at(to),
  source: 'unplanned_stop_with_failure_code',
  repairStart: null,
  repairEnd: null,
  incident,
});

const input = (failures: FailureSpan[]): ReliabilityInput => ({
  window: { start: at(0), end: at(8 * 60 * MIN) },
  asOf: at(8 * 60 * MIN),
  failures,
  exposure: new Dec(8 * 3600),
  microStopSeconds: 60,
});

const metric = (kpis: KpiDraft[], name: string) => {
  const found = kpis.find(
    (k) => k.metric === name && k.scope.level === 'period',
  );
  if (!found) throw new Error(`no ${name}`);
  return found;
};

describe('D5 incident counted once in MTBF', () => {
  const incident = { id: 'i1', start: at(0) };
  // SME example: 10:00–10:03 and 10:05–10:09, one unresolved jam
  const grouped = [
    failure('s1', 0, 3 * MIN, incident),
    failure('s2', 5 * MIN, 9 * MIN, incident),
  ];

  it('two stops of one incident → one failure; MTBF 28800 s', () => {
    const mtbf = metric(reliability(input(grouped)), 'mtbf');
    expect(mtbf.denominator?.toString()).toBe('1');
    expect(mtbf.value?.toString()).toBe('28800');
    expect(mtbf.cohort).toMatchObject({ repeatStopsInIncidents: 1 });
  });

  it('without the incident the same stops are two failures', () => {
    const plain = grouped.map((f) => ({ ...f, incident: null }));
    expect(
      metric(reliability(input(plain)), 'mtbf').denominator?.toString(),
    ).toBe('2');
  });

  it('durations stay per stop: mean time to restore over 2 stops (3 and 4 min)', () => {
    const restore = metric(
      reliability(input(grouped)),
      'mean_downtime_to_restore',
    );
    expect(restore.denominator?.toString()).toBe('2');
    expect(restore.numerator?.toString()).toBe(String(7 * MIN));
  });

  it('an incident that began before the window is not counted again', () => {
    const earlier = { id: 'i0', start: at(-10 * MIN) };
    const carried = [failure('s3', 1 * MIN, 4 * MIN, earlier)];
    expect(
      metric(reliability(input(carried)), 'mtbf').denominator?.toString(),
    ).toBe('0');
  });
});
