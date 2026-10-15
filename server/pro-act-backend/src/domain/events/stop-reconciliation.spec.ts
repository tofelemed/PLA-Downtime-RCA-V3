import { SourceKind } from './event-classification';
import {
  matchOf,
  pairKey,
  planReconciliation,
  ReconcilableStop,
} from './stop-reconciliation';

const T0 = Date.UTC(2026, 9, 15, 10);
const t = (s: number) => new Date(T0 + s * 1000);
const NONE = new Set<string>();

function stop(
  id: string,
  sourceKind: SourceKind,
  span: [number, number | null],
  extra: Partial<ReconcilableStop> = {},
): ReconcilableStop {
  return {
    id,
    unitId: 'u1',
    assetId: null,
    sourceKind,
    start: t(span[0]),
    end: span[1] === null ? null : t(span[1]),
    createdAt: t(0),
    cause: {},
    ...extra,
  };
}

const plan = (stops: ReconcilableStop[], blocked: Set<string> = NONE) =>
  planReconciliation(stops, { toleranceSeconds: 120, blocked });

describe('stop duplicate reconciliation and source authority (DT-04, SME D5, plan 1.10 SRC02)', () => {
  it('PI EF 10:00–11:00 and a derived stop 10:00:05–10:59:50: one stop, derived timing kept, PI cause copied', () => {
    const pairs = plan([
      stop('pi', 'source', [0, 3600], {
        assetId: 'a1',
        cause: { reasonCodeId: 'r-motor' },
      }),
      stop('derived', 'derived', [5, 3590]),
    ]);
    expect(pairs).toEqual([
      {
        keptId: 'derived',
        evidenceId: 'pi',
        mode: 'auto',
        suggestionReason: null,
        startDeltaSeconds: 5,
        endDeltaSeconds: 10,
        conflicts: [],
        copied: { reasonCodeId: 'r-motor', assetId: 'a1' },
      },
    ]);
  });

  it('manual vs PI: the PI frame keeps the timing; the operator reason fills the empty reason', () => {
    const [pair] = plan([
      stop('manual', 'manual', [60, 3540], {
        cause: { reasonCodeId: 'r-jam' },
      }),
      stop('pi', 'source', [0, 3600]),
    ]);
    expect(pair).toMatchObject({
      keptId: 'pi',
      evidenceId: 'manual',
      mode: 'auto',
      copied: { reasonCodeId: 'r-jam' },
    });
  });

  it('manual, PI and derived for one stop: both merge into the derived stop; the operator reason wins', () => {
    const pairs = plan([
      stop('manual', 'manual', [30, 3600], {
        cause: { reasonCodeId: 'r-operator' },
      }),
      stop('pi', 'source', [0, 3600], { cause: { reasonCodeId: 'r-pi' } }),
      stop('derived', 'derived', [5, 3590]),
    ]);
    expect(
      pairs.map((p) => [p.keptId, p.evidenceId, p.mode, p.copied]),
    ).toEqual([
      ['derived', 'manual', 'auto', { reasonCodeId: 'r-operator' }],
      ['derived', 'pi', 'auto', {}],
    ]);
  });

  it('beyond the tolerance or without overlap there is no pair', () => {
    expect(
      plan([stop('m', 'manual', [0, 600]), stop('p', 'source', [300, 900])]),
    ).toEqual([]);
    // two 30 s micro-stops 90 s apart are two stops, not one entered twice
    expect(
      plan([stop('m', 'manual', [0, 30]), stop('p', 'source', [90, 120])]),
    ).toEqual([]);
  });

  it('another asset is another stop; a unit-level stop matches any asset of the unit', () => {
    const a = stop('m', 'manual', [0, 600], { assetId: 'a1' });
    expect(
      matchOf(a, stop('p', 'source', [0, 600], { assetId: 'a2' }), 120),
    ).toBeNull();
    expect(matchOf(a, stop('d', 'derived', [0, 600]), 120)).not.toBeNull();
  });

  it('an open stop matches on its start', () => {
    expect(
      matchOf(
        stop('m', 'manual', [0, null]),
        stop('p', 'source', [20, 900]),
        120,
      ),
    ).toEqual({
      startDeltaSeconds: 20,
      endDeltaSeconds: null,
    });
  });

  it('two manual entries of one stop are only suggested (same source)', () => {
    const [pair] = plan([
      stop('m1', 'manual', [0, 600]),
      stop('m2', 'manual', [10, 610], { createdAt: t(700) }),
    ]);
    expect(pair).toMatchObject({
      keptId: 'm1',
      evidenceId: 'm2',
      mode: 'suggested',
      suggestionReason: 'same_source',
    });
  });

  it('different reasons on both sides are a conflict a person resolves', () => {
    const [pair] = plan([
      stop('m', 'manual', [0, 600], { cause: { reasonCodeId: 'r1' } }),
      stop('p', 'source', [0, 600], { cause: { reasonCodeId: 'r2' } }),
    ]);
    expect(pair).toMatchObject({
      mode: 'suggested',
      suggestionReason: 'cause_conflict',
      conflicts: ['reasonCodeId'],
    });
  });

  it('a unit-level manual stop matching two PI frames of different assets is ambiguous', () => {
    const pairs = plan([
      stop('m', 'manual', [0, 600]),
      stop('p1', 'source', [0, 600], { assetId: 'a1' }),
      stop('p2', 'source', [5, 600], { assetId: 'a2' }),
    ]);
    expect(
      pairs.map((p) => [p.keptId, p.evidenceId, p.suggestionReason]),
    ).toEqual([
      ['p1', 'm', 'ambiguous'],
      ['p2', 'm', 'ambiguous'],
    ]);
  });

  it('a pair a person rejected or undid is never proposed again', () => {
    const stops = [
      stop('m', 'manual', [0, 600]),
      stop('p', 'source', [0, 600]),
    ];
    expect(plan(stops, new Set([pairKey('p', 'm')]))).toEqual([]);
  });

  it('property: the plan does not depend on the input order', () => {
    const stops = [
      stop('manual', 'manual', [30, 3600], { cause: { reasonCodeId: 'r1' } }),
      stop('pi', 'source', [0, 3600], { assetId: 'a1' }),
      stop('derived', 'derived', [5, 3590]),
      stop('other', 'manual', [7200, 7300]),
    ];
    const expected = plan(stops);
    for (const order of [
      [3, 2, 1, 0],
      [1, 3, 0, 2],
      [2, 0, 3, 1],
    ]) {
      expect(plan(order.map((i) => stops[i]))).toEqual(expected);
    }
  });
});
