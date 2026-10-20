import {
  PortfolioActionFact,
  PortfolioCaseFact,
  portfolioFigures,
  realizedOf,
} from './portfolio-figures';
import {
  decodePortfolioCursor,
  encodePortfolioCursor,
} from './portfolio-cursor';

const caseFact = (
  id: string,
  status: string | null,
  createdAt: string,
): PortfolioCaseFact => ({ id, title: `Case ${id}`, status, createdAt });

const action = (
  rcaId: string,
  overrides: Partial<PortfolioActionFact> = {},
): PortfolioActionFact => ({
  rcaId,
  status: 'open',
  overdue: false,
  claimed: null,
  claimedCurrency: null,
  verdict: null,
  realized: null,
  evaluatedAt: null,
  ...overrides,
});

const CASES = new Map(
  [
    caseFact('c1', 'Closed', '2026-09-01T00:00:00.000Z'),
    caseFact('c2', 'Monitoring', '2026-09-03T00:00:00.000Z'),
    caseFact('c3', null, '2026-09-02T00:00:00.000Z'),
    caseFact('c9', 'Analysis', '2026-09-04T00:00:00.000Z'),
  ].map((c) => [c.id, c]),
);

const ACTIONS: PortfolioActionFact[] = [
  action('c1', {
    status: 'done',
    claimed: '1000.10',
    claimedCurrency: 'USD',
    verdict: 'effective',
    realized: { metric: 'recurrences', difference: '2' },
    evaluatedAt: '2026-10-01T00:00:00.000Z',
  }),
  action('c1', {
    status: 'done',
    claimed: '0.20',
    claimedCurrency: 'USD',
    verdict: 'not_effective',
    realized: { metric: 'recurrences', difference: '5' },
    evaluatedAt: '2026-10-05T00:00:00.000Z',
  }),
  action('c2', { overdue: true, claimed: '42000000', claimedCurrency: 'IRR' }),
  action('c2', { status: 'in_progress' }),
  action('c2', {
    status: 'done',
    verdict: 'insufficient_evidence',
    realized: { metric: 'downtime_seconds', difference: '-120.5' },
    evaluatedAt: '2026-10-02T00:00:00.000Z',
  }),
  action('c3', { status: 'cancelled', claimed: '7', claimedCurrency: 'USD' }),
  action('c9', { claimed: '999', claimedCurrency: 'USD' }),
];

describe('RCA portfolio figures (item 2.1)', () => {
  const figures = portfolioFigures(
    ['c1', 'c2', 'c3', 'c1'],
    { cases: CASES, actions: ACTIONS },
    'USD',
  );

  it('counts each case of the row once by status, newest first in the sample', () => {
    expect(figures.cases.total).toBe(3);
    expect(figures.cases.byStatus).toEqual([
      { status: 'Closed', count: 1 },
      { status: 'Draft', count: 1 },
      { status: 'Monitoring', count: 1 },
    ]);
    expect(figures.cases.sample.map((c) => c.id)).toEqual(['c2', 'c3', 'c1']);
  });

  it('counts only the actions of the row’s cases: open includes overdue, cancelled apart', () => {
    expect(figures.actions).toEqual({
      total: 6,
      open: 2,
      overdue: 1,
      done: 3,
      cancelled: 1,
    });
  });

  it('counts verdicts; an action without a verdict is pending unless cancelled', () => {
    expect(figures.effectiveness).toEqual({
      effective: 1,
      notEffective: 1,
      insufficientEvidence: 1,
      pending: 2,
    });
  });

  it('sums claims in the asked currency with decimals and counts the others, never converting', () => {
    expect(figures.claimedAvoided).toEqual([
      { currency: 'USD', amount: '1007.3', actions: 3 },
    ]);
    expect(figures.claimsInOtherCurrencies).toBe(1);
    const irr = portfolioFigures(
      ['c1', 'c2', 'c3'],
      { cases: CASES, actions: ACTIONS },
      'IRR',
    );
    expect(irr.claimedAvoided).toEqual([
      { currency: 'IRR', amount: '42000000', actions: 1 },
    ]);
    expect(irr.claimsInOtherCurrencies).toBe(3);
  });

  it('keeps the three figures apart: claims and realised differences are not money totals of each other', () => {
    expect(figures.realized).toEqual([
      { metric: 'recurrences', difference: '5', cases: 1 },
      { metric: 'downtime_seconds', difference: '-120.5', cases: 1 },
    ]);
    expect(Object.keys(figures)).toEqual([
      'cases',
      'actions',
      'effectiveness',
      'claimedAvoided',
      'claimsInOtherCurrencies',
      'realized',
    ]);
  });

  it('realised: the latest evaluation per case and metric, summed across cases', () => {
    const realized = realizedOf([
      ...ACTIONS,
      action('c9', {
        realized: { metric: 'recurrences', difference: '1.5' },
        evaluatedAt: '2026-10-09T00:00:00.000Z',
      }),
      action('c9', { realized: { metric: 'unknown', difference: '100' } }),
    ]);
    expect(realized[0]).toEqual({
      metric: 'recurrences',
      difference: '6.5',
      cases: 2,
    });
  });

  it('a row without cases or actions has zero counts and no figures', () => {
    const empty = portfolioFigures(
      [],
      { cases: CASES, actions: ACTIONS },
      'USD',
    );
    expect(empty.cases).toEqual({ total: 0, byStatus: [], sample: [] });
    expect(empty.claimedAvoided).toEqual([]);
    expect(empty.realized).toEqual([]);
  });
});

describe('RCA portfolio cursor', () => {
  it('round-trips the keyset position and refuses foreign cursors', () => {
    const position = { cases: 4, sortKey: '0RC-01', rowKey: 'uncoded' };
    expect(decodePortfolioCursor(encodePortfolioCursor(position))).toEqual(
      position,
    );
    expect(decodePortfolioCursor(undefined)).toBeNull();
    const foreign = Buffer.from(JSON.stringify({ s: 5, i: 'x' })).toString(
      'base64url',
    );
    expect(() => decodePortfolioCursor(foreign)).toThrow();
    expect(() => decodePortfolioCursor('not-a-cursor')).toThrow();
  });
});
