import { Dec } from '../domain/actuals/decimal';
import {
  attributeOutputs,
  OutputStreamRun,
  StreamedOutputEvent,
} from '../domain/actuals/period/output-attribution';
import { ResolvedPolicies } from './accounting-policies.service';
import { PeriodInputs } from './actuals-inputs.loader';
import { PeriodProductSlice } from './entities/period-product-slice.entity';
import { computePeriodActuals } from './period-actuals.compute';
import {
  COVERAGE_GATE_DEFAULT,
  SOURCE_AUTHORITY_DEFAULT,
} from './policy-bodies';

/**
 * SME E6 worked example through the period actuals (2.4.4). Reactor stream R makes grade A 06:00–14:00
 * (lot L-A) and grade B from 14:00 (lot L-B). At 14:00–15:00 packaging bags 25 t from the silo, which
 * still holds grade A: the bag carries lot L-A, so it belongs to A's production (06:00–14:00), never to
 * B. Two parallel trains T1 (A) and T2 (B) share a window: each train's output goes to its own product,
 * so neither is ambiguous and no tonne is assigned twice.
 */
const T0 = Date.parse('2027-03-01T06:00:00Z');
const at = (hours: number) => new Date(T0 + hours * 3_600_000);

const sliceOf = (
  id: string,
  productId: string,
  from: number,
  to: number,
): PeriodProductSlice =>
  ({
    id,
    productId,
    windowFrom: at(from),
    windowTo: at(to),
    quantityUom: 't',
  }) as unknown as PeriodProductSlice;

const policies: ResolvedPolicies = {
  coverageGate: { ...COVERAGE_GATE_DEFAULT, requiredCoverageRatio: 0 },
  sourceAuthority: SOURCE_AUTHORITY_DEFAULT,
  refs: [],
  sourceAuthorityId: 'policy-1',
};

const output = (
  identity: string,
  from: number,
  to: number,
  quantity: string,
  extra: Partial<StreamedOutputEvent> = {},
): StreamedOutputEvent => ({
  identity,
  revision: 1,
  start: at(from),
  end: at(to),
  quantity,
  rejects: '0',
  uom: 't',
  ...extra,
});

const run = (
  id: string,
  streamId: string,
  productId: string,
  from: number,
  to: number | null,
  lotCode: string | null = null,
): OutputStreamRun => ({
  id,
  streamId,
  productId,
  lotCode,
  start: at(from),
  end: to === null ? null : at(to),
});

const REACTOR = [
  run('r-a', 'R', 'A', 0, 8, 'L-A'),
  run('r-b', 'R', 'B', 8, null, 'L-B'),
];

const inputs = (
  events: StreamedOutputEvent[],
  streamRuns: OutputStreamRun[],
): PeriodInputs => ({
  events,
  streamRuns,
  stops: [],
  signals: [],
  adjustments: [],
  reportLines: [],
});

describe('SME E6: output attributed by stream run and lot', () => {
  it('a bag of lot L-A packed after the switch to B belongs to A over its production interval', () => {
    const [bag] = attributeOutputs(
      [output('bag-1', 8, 9, '25', { lotCode: 'L-A' })],
      REACTOR,
    );
    expect(bag.productId).toBe('A');
    expect(bag.event.start).toEqual(at(0));
    expect(bag.event.end).toEqual(at(8));
    const results = computePeriodActuals(
      [sliceOf('slice-a', 'A', 0, 8), sliceOf('slice-b', 'B', 8, 16)],
      inputs(
        [
          output('reactor-b', 8, 16, '160', { streamId: 'R' }),
          output('bag-1', 8, 9, '25', { lotCode: 'L-A' }),
        ],
        REACTOR,
      ),
      policies,
    );
    expect(results.get('slice-a')?.gross).toBe('25');
    // B gets its reactor output only: a unit-wide grade label would have added the 25 t of A
    expect(results.get('slice-b')?.gross).toBe('160');
  });

  it('splits a stream output across a product change by time, conserving the mass (estimated)', () => {
    const pieces = attributeOutputs(
      [output('reactor', 7, 10, '100', { streamId: 'R' })],
      REACTOR,
    );
    expect(pieces.map((p) => [p.productId, p.event.quantity])).toEqual([
      ['A', '33.33333333'],
      ['B', '66.66666667'],
    ]);
    const total = pieces.reduce(
      (s, p) => s.plus(new Dec(String(p.event.quantity))),
      new Dec(0),
    );
    expect(total.toString()).toBe('100');
    expect(pieces.every((p) => p.event.estimated)).toBe(true);
  });

  it('two parallel trains in a shared window: each product gets its own train output', () => {
    const trains = [
      run('t1', 'T1', 'A', -2, null),
      run('t2', 'T2', 'B', -2, null),
    ];
    const results = computePeriodActuals(
      [sliceOf('slice-a', 'A', 0, 8), sliceOf('slice-b', 'B', 0, 8)],
      inputs(
        [
          output('t1-out', 0, 8, '240', { streamId: 'T1' }),
          output('t2-out', 0, 8, '160', { streamId: 'T2' }),
        ],
        trains,
      ),
      policies,
    );
    expect(results.get('slice-a')?.gross).toBe('240');
    expect(results.get('slice-b')?.gross).toBe('160');
    expect(results.get('slice-a')?.findings.map((f) => f.code)).not.toContain(
      'product_attribution_unavailable',
    );
  });

  it('keeps unit-level output unattributable in a shared window and unchanged without runs', () => {
    const shared = [
      sliceOf('slice-a', 'A', 0, 8),
      sliceOf('slice-b', 'B', 0, 8),
    ];
    const unitOutput = [output('unit-out', 0, 8, '400')];
    const results = computePeriodActuals(
      shared,
      inputs(unitOutput, []),
      policies,
    );
    expect(results.get('slice-a')?.gross).toBeNull();
    const single = computePeriodActuals(
      [sliceOf('slice-a', 'A', 0, 8)],
      inputs(unitOutput, []),
      policies,
    );
    expect(single.get('slice-a')?.gross).toBe('400');
  });
});
