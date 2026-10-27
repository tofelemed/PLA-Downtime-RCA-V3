import { SelectQueryBuilder } from 'typeorm';
import { Dec, ZERO } from '../../domain/actuals/decimal';
import { SliceReconciliation } from '../../domain/reconciliation/reconciliation.types';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { keysetCursorAt, keysetPage } from '../common/keyset-page';
import { PeriodState } from './period-states';
import {
  RESIDUAL_SCAN_MAX,
  summaryPage,
  takeMatching,
} from './period-summary-page';

jest.mock('../common/keyset-page', () => ({
  keysetPage: jest.fn(),
  keysetCursorAt: jest.fn(),
}));

const pageMock = keysetPage as jest.MockedFunction<typeof keysetPage>;
const cursorAtMock = keysetCursorAt as jest.MockedFunction<
  typeof keysetCursorAt
>;

function slice(residual: string): SliceReconciliation {
  return {
    sliceId: 's',
    uom: 't',
    target: new Dec('100'),
    actual: new Dec('90'),
    gap: new Dec('10'),
    attributed: ZERO,
    declaredGain: ZERO,
    toleranceAdjustment: ZERO,
    unadjustedResidual: new Dec(residual),
    residual: new Dec(residual),
    overAccounted: null,
    overproduction: null,
    tolerance: new Dec('1'),
    flags: [],
  };
}

/** A period whose residual is `residual` tonnes (null = not computable); tolerance 1 t. */
function state(id: string, residual: string | null): PeriodState {
  const computable = residual !== null;
  return {
    period: { id } as ProductionPeriod,
    revision: null,
    publishedRevision: null,
    run: null,
    totals: [],
    actuals: [],
    candidates: [],
    lines: [],
    rule: computable
      ? ({ epsilon: new Dec('0.001') } as PeriodState['rule'])
      : null,
    reconciliation: computable
      ? { slices: [slice(residual)], candidates: [], lineFlags: [] }
      : null,
    lossBasis: null,
  };
}

const build = () => ({}) as SelectQueryBuilder<ProductionPeriod>;

describe('takeMatching', () => {
  it('keeps the wanted residual states and reports where the page filled', () => {
    const kept: PeriodState[] = [];
    const states = [
      state('a', '5'),
      state('b', '0.5'),
      state('c', null),
      state('d', '-5'),
      state('e', '7'),
    ];
    const index = takeMatching(
      states,
      new Set(['unaccounted', 'over_accounted']),
      kept,
      2,
    );
    expect(index).toBe(3);
    expect(kept.map((s) => s.period.id)).toEqual(['a', 'd']);
  });

  it('is null when the page did not fill', () => {
    const kept: PeriodState[] = [];
    expect(
      takeMatching([state('a', null)], new Set(['not_computable']), kept, 5),
    ).toBeNull();
    expect(kept).toHaveLength(1);
  });
});

describe('summaryPage (UX D-5 / D-6)', () => {
  beforeEach(() => {
    pageMock.mockReset();
    cursorAtMock.mockReset();
  });

  const byId = new Map<string, PeriodState>();
  const load = (periods: ProductionPeriod[]) =>
    Promise.resolve(periods.map((p) => byId.get(p.id) as PeriodState));
  function register(states: PeriodState[]): ProductionPeriod[] {
    for (const s of states) byId.set(s.period.id, s);
    return states.map((s) => s.period);
  }

  it('without residualStates is one keyset page in the requested direction', async () => {
    pageMock.mockResolvedValueOnce({
      items: register([state('a', '5')]),
      nextCursor: 'next',
    });
    const page = await summaryPage({
      build,
      direction: 'DESC',
      limit: 1,
      load,
    });
    expect(pageMock).toHaveBeenCalledWith(expect.anything(), {
      alias: 'p',
      property: 'utcStart',
      direction: 'DESC',
      cursor: undefined,
      limit: 1,
    });
    expect(page.nextCursor).toBe('next');
    expect(page.states.map((s) => s.period.id)).toEqual(['a']);
  });

  it('scans batches until the page fills and resumes right after the last returned period', async () => {
    pageMock
      .mockResolvedValueOnce({
        items: register([state('a', '0'), state('b', '5')]),
        nextCursor: 'after-b',
      })
      .mockResolvedValueOnce({
        items: register([state('c', '6'), state('d', '7')]),
        nextCursor: null,
      });
    cursorAtMock.mockResolvedValueOnce('at-c');
    const page = await summaryPage({
      build,
      direction: 'ASC',
      limit: 2,
      load,
      residualStates: ['unaccounted'],
    });
    expect(page.states.map((s) => s.period.id)).toEqual(['b', 'c']);
    expect(page.nextCursor).toBe('at-c');
    expect(cursorAtMock).toHaveBeenCalledWith(
      expect.anything(),
      'utcStart',
      'c',
    );
    expect(pageMock.mock.calls[1][1].cursor).toBe('after-b');
  });

  it('ends with no cursor when the page fills on the very last period of the scope', async () => {
    pageMock.mockResolvedValueOnce({
      items: register([state('a', '0'), state('b', '5')]),
      nextCursor: null,
    });
    const page = await summaryPage({
      build,
      direction: 'ASC',
      limit: 1,
      load,
      residualStates: ['unaccounted'],
    });
    expect(page.states.map((s) => s.period.id)).toEqual(['b']);
    expect(page.nextCursor).toBeNull();
  });

  it('returns a short page with the scan cursor after examining RESIDUAL_SCAN_MAX periods', async () => {
    pageMock.mockImplementation((_qb, options) =>
      Promise.resolve({
        items: register(
          Array.from({ length: options.limit }, (_, i) =>
            state(`${String(options.cursor)}-${i}`, '0'),
          ),
        ),
        nextCursor: `${String(options.cursor)}+`,
      }),
    );
    const page = await summaryPage({
      build,
      direction: 'ASC',
      limit: 10,
      load,
      residualStates: ['unaccounted'],
    });
    const examined = pageMock.mock.calls.reduce(
      (sum, call) => sum + call[1].limit,
      0,
    );
    expect(examined).toBe(RESIDUAL_SCAN_MAX);
    expect(page.states).toEqual([]);
    expect(page.nextCursor).not.toBeNull();
  });
});
