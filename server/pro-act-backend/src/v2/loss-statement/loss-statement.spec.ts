import { Dec } from '../../domain/actuals/decimal';
import {
  Candidate,
  DecisionLine,
  SliceReconciliation,
} from '../../domain/reconciliation/reconciliation.types';
import { reconcile } from '../../domain/reconciliation/reconcile';
import {
  periodStatement,
  StatementSource,
  statementView,
} from './loss-statement';
import { addStatement, statementSum, sumView } from './statement-sum';

const d = (value: string) => new Dec(value);
const RULE = {
  mode: 'zero' as const,
  value: d('0'),
  epsilon: d('0.000001'),
  allowUnaccountedClassification: true,
};

const candidate = (autoKey: string, kind: Candidate['kind'], q: string) => ({
  autoKey,
  sliceId: 'S1',
  kind,
  quantity: d(q),
});

function source(
  given: {
    target?: string | null;
    actual?: string | null;
    candidates?: Candidate[];
    lines?: DecisionLine[];
    runLines?: StatementSource['runLines'];
  } = {},
): StatementSource {
  const candidates = given.candidates ?? [
    candidate('a', 'availability', '23'),
    candidate('p', 'performance', '11'),
    candidate('q', 'quality', '6'),
  ];
  const lines = given.lines ?? [];
  const target = given.target === undefined ? '240' : given.target;
  const actual = given.actual === undefined ? '208' : given.actual;
  return {
    candidates,
    lines,
    reconciliation: reconcile({
      candidates,
      lines,
      rule: RULE,
      slices: [
        {
          sliceId: 'S1',
          uom: 't',
          target: target === null ? null : d(target),
          actual: actual === null ? null : d(actual),
          flags: [],
        },
      ],
    }),
    runLines: given.runLines ?? [{ kind: 'gain', quantity: d('-8') }],
    recoveryVerified: true,
    revisionState: 'approved',
  };
}

/** Task 13: the owner's statement, 240 / 208 / 32 / 23 / 11 / 6 / 40 / −8 / 32 / 0. */
describe('periodStatement', () => {
  it('states the owner example exactly, every sum server-side', () => {
    expect(statementView(periodStatement(source()))).toEqual({
      planned: '240',
      actual: '208',
      shortfall: '32',
      availability: '23',
      performance: '11',
      quality: '6',
      transitionExcess: '0',
      unaccountedClassified: '0',
      grossAttributed: '40',
      recovery: '8',
      recoveryVerified: true,
      netAccounted: '32',
      toleranceAdjustment: '0',
      unaccounted: '0',
      uom: 't',
      revisionState: 'approved',
    });
  });

  it('keeps the identity with decisions, manual lines, transitions and tolerance adjustments', () => {
    const lines: DecisionLine[] = [
      {
        action: 'adjust',
        autoKey: 'a',
        sliceId: 'S1',
        kind: 'availability',
        quantity: d('20'),
        baseQuantity: d('23'),
        missingCode: false,
      },
      {
        action: 'manual',
        autoKey: null,
        sliceId: 'S1',
        kind: 'unaccounted_classified',
        quantity: d('1'),
        baseQuantity: null,
        missingCode: false,
      },
      {
        action: 'tolerance',
        autoKey: null,
        sliceId: 'S1',
        kind: 'tolerance_adjustment',
        quantity: d('0.5'),
        baseQuantity: null,
        missingCode: false,
      },
    ];
    const view = statementView(
      periodStatement(
        source({
          lines,
          runLines: [
            { kind: 'transition_excess', quantity: d('2') },
            { kind: 'gain', quantity: d('-8') },
          ],
        }),
      ),
    );
    expect(view).toMatchObject({
      availability: '20',
      transitionExcess: '2',
      unaccountedClassified: '1',
      grossAttributed: '40',
      netAccounted: '32',
      toleranceAdjustment: '0.5',
      unaccounted: '-0.5',
    });
  });

  it('a rejected candidate adds nothing; the residual is the rest of the shortfall', () => {
    const lines: DecisionLine[] = [
      {
        action: 'reject',
        autoKey: 'q',
        sliceId: 'S1',
        kind: 'quality',
        quantity: null,
        baseQuantity: d('6'),
        missingCode: false,
      },
    ];
    expect(
      statementView(periodStatement(source({ lines, runLines: [] }))),
    ).toMatchObject({ quality: '0', grossAttributed: '34', unaccounted: '-2' });
  });

  it('without actuals the plan figures and the unaccounted loss are unknown, never 0', () => {
    const view = statementView(periodStatement(source({ actual: null })));
    expect(view).toMatchObject({
      planned: '240',
      actual: null,
      shortfall: null,
      unaccounted: null,
      grossAttributed: '40',
    });
  });
});

describe('statement sums', () => {
  it('adds complete periods, counts the others and marks a provisional one', () => {
    const sum = statementSum();
    addStatement(sum, periodStatement(source()));
    addStatement(sum, {
      ...periodStatement(source({ runLines: [] })),
      revisionState: 'provisional',
      recoveryVerified: false,
    });
    addStatement(sum, periodStatement(source({ target: null })));
    addStatement(sum, null);
    expect(sum.incomplete).toBe(2);
    expect(sumView(sum)).toMatchObject({
      planned: '480',
      shortfall: '64',
      grossAttributed: '80',
      recovery: '8',
      netAccounted: '72',
      unaccounted: '-8',
      revisionState: 'provisional',
      recoveryVerified: false,
    });
  });

  it('is null without a complete period, and for different units of measure', () => {
    expect(sumView(statementSum())).toBeNull();
    const sum = statementSum();
    addStatement(sum, periodStatement(source()));
    const other = periodStatement(source());
    addStatement(sum, { ...other, uom: 'kg' });
    expect(sumView(sum)).toBeNull();
  });
});

describe('slice sums', () => {
  it('a period of two slices sums both', () => {
    const base = source();
    const second: SliceReconciliation = {
      ...base.reconciliation.slices[0],
      sliceId: 'S2',
    };
    const statement = periodStatement({
      ...base,
      reconciliation: {
        ...base.reconciliation,
        slices: [...base.reconciliation.slices, second],
      },
    });
    expect(statementView(statement)).toMatchObject({
      planned: '480',
      actual: '416',
      shortfall: '64',
    });
  });
});
