import { Dec } from '../../src/domain/actuals/decimal';
import { KpiDraft } from '../../src/domain/kpi/kpi.types';
import {
  FailureSpan,
  reliability,
  ReliabilityInput,
} from '../../src/domain/kpi/reliability';

/**
 * SME D9 / DT-10 (KPI engine 2.7.7): a standby asset's MTBF is judged on its own running time (the runs of
 * its standby log), never on the unit's run time; a failure outside its runs (failed start, dormant
 * failure) is failure on demand and stays with the standby measures; zero failures → null with exposure.
 */
const T0 = Date.parse('2027-03-03T02:30:00Z');
const HOUR = 3600;
const at = (seconds: number) => new Date(T0 + seconds * 1000);

const failure = (
  id: string,
  assetId: string,
  from: number,
  to: number | null,
): FailureSpan => ({
  occurrenceId: id,
  assetId,
  start: at(from),
  end: to === null ? null : at(to),
  source: 'unplanned_stop_with_failure_code',
  repairStart: null,
  repairEnd: null,
});

function base(extra: Partial<ReliabilityInput>): ReliabilityInput {
  return {
    window: { start: at(0), end: at(8 * HOUR) },
    asOf: at(8 * HOUR),
    failures: [],
    exposure: new Dec(8 * HOUR),
    microStopSeconds: 60,
    ...extra,
  };
}

const mtbfOf = (kpis: KpiDraft[], assetId?: string) => {
  const found = kpis.find(
    (k) =>
      k.metric === 'mtbf' &&
      (assetId ? k.scope.assetId === assetId : k.scope.level === 'period'),
  );
  if (!found) throw new Error(`no mtbf for ${assetId ?? 'the period'}`);
  return found;
};
const str = (value: Dec | null) => (value === null ? null : value.toString());

describe('D9 standby asset MTBF on its own running time', () => {
  const input = base({
    failures: [
      failure('f1', 'spare', 2 * HOUR, 2 * HOUR + 600),
      failure('f2', 'spare', 4 * HOUR, 4 * HOUR + 300),
      failure('f3', 'duty', HOUR, HOUR + 900),
    ],
    standby: [
      {
        assetId: 'spare',
        runs: [
          { start: at(HOUR), end: at(3 * HOUR) },
          // overlaps the first run: counted once
          { start: at(2 * HOUR), end: at(3 * HOUR) },
          // still running at asOf
          { start: at(5 * HOUR), end: null },
        ],
      },
    ],
  });
  const kpis = reliability(input);

  it('running 5 h, one failure while running → MTBF 18000 s', () => {
    const spare = mtbfOf(kpis, 'spare');
    expect(str(spare.numerator)).toBe(String(5 * HOUR));
    expect(str(spare.denominator)).toBe('1');
    expect(str(spare.value)).toBe(String(5 * HOUR));
    expect(spare.cohort).toMatchObject({
      exposureBasis: 'asset_running_time',
      failureDefinition: 'D13',
      failuresOutsideRunning: 1,
    });
  });

  it('the duty asset and the unit keep the unit run time', () => {
    expect(str(mtbfOf(kpis, 'duty').numerator)).toBe(String(8 * HOUR));
    expect(mtbfOf(kpis, 'duty').cohort).toMatchObject({
      exposureBasis: 'unit_run_time',
    });
    const unit = mtbfOf(kpis);
    expect(str(unit.numerator)).toBe(String(8 * HOUR));
    expect(str(unit.denominator)).toBe('3');
  });

  it('a standby asset without failures → null with its running exposure, never infinite', () => {
    const quiet = reliability(
      base({
        standby: [
          {
            assetId: 'spare',
            runs: [{ start: at(-HOUR), end: at(2 * HOUR) }],
          },
        ],
      }),
    );
    expect(mtbfOf(quiet, 'spare')).toMatchObject({
      value: null,
      reason: 'no_failures',
      quality: 'unavailable',
    });
    expect(str(mtbfOf(quiet, 'spare').numerator)).toBe(String(2 * HOUR));
    expect(str(mtbfOf(quiet, 'spare').denominator)).toBe('0');
  });

  it('never ran and failed on demand only → null, no running exposure', () => {
    const dormant = reliability(
      base({
        failures: [failure('f1', 'spare', HOUR, HOUR + 60 * 5)],
        standby: [{ assetId: 'spare', runs: [] }],
      }),
    );
    expect(mtbfOf(dormant, 'spare')).toMatchObject({
      value: null,
      reason: 'no_running_exposure',
    });
    expect(str(mtbfOf(dormant, 'spare').numerator)).toBe('0');
    expect(mtbfOf(dormant, 'spare').cohort).toMatchObject({
      failuresOutsideRunning: 1,
    });
  });

  it('without standby assets the result is unchanged (unit run time for every asset)', () => {
    const plain = reliability(base({ failures: input.failures }));
    expect(str(mtbfOf(plain, 'spare').numerator)).toBe(String(8 * HOUR));
    expect(str(mtbfOf(plain, 'spare').denominator)).toBe('2');
  });
});
