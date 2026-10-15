import { PolicyBodyError } from './policy-bodies';
import {
  bridgeLimitsOf,
  dayGateOf,
  reconciliationOptions,
  reversibleKindsOf,
  submitGateOf,
} from './reconciliation-options';

const BUDGET = '7f0c3a52-1d8e-4b8e-9a39-0d2f4c5e6a71';

/** SME D12 / R8 / R9 options of `reconciliation_tolerance` (absent in older versions). */
describe('reconciliation options', () => {
  it('a version without the options keeps them absent; readers get the pilot defaults', () => {
    const options = reconciliationOptions({});
    expect(options).toEqual({});
    expect(submitGateOf(options)).toEqual({
      mode: 'warn',
      codedRatioTarget: 0.95,
    });
    expect(bridgeLimitsOf(options)).toEqual({
      absolute: null,
      relative: null,
      overLimit: 'second_review',
    });
    expect(reversibleKindsOf(options)).toContain('availability');
    expect(dayGateOf(options)).toEqual({ mode: 'warn', codedRatioTarget: 0.99 });
  });

  it('D12 daily target: dayGate has the shape of the shift gate and is validated the same way', () => {
    expect(
      reconciliationOptions({
        dayGate: { mode: 'block', codedRatioTarget: 0.99 },
      }).dayGate,
    ).toEqual({ mode: 'block', codedRatioTarget: 0.99 });
    expect(() =>
      reconciliationOptions({ dayGate: { mode: 'block', codedRatioTarget: 1.2 } }),
    ).toThrow('dayGate.codedRatioTarget must be a ratio between 0 and 1');
    expect(() =>
      reconciliationOptions({ dayGate: { mode: 'stop', codedRatioTarget: 0.99 } }),
    ).toThrow(PolicyBodyError);
  });

  it('R8 + E4: an absolute bridge limit may name the uncertainty budget that justifies it', () => {
    expect(
      reconciliationOptions({
        bridgeLimits: {
          absolute: 2,
          relative: null,
          overLimit: 'refuse',
          uncertaintyBudgetId: BUDGET,
        },
      }).bridgeLimits,
    ).toEqual({
      absolute: 2,
      relative: null,
      overLimit: 'refuse',
      uncertaintyBudgetId: BUDGET,
    });
    expect(() =>
      reconciliationOptions({
        bridgeLimits: {
          absolute: null,
          relative: 0.01,
          overLimit: 'refuse',
          uncertaintyBudgetId: BUDGET,
        },
      }),
    ).toThrow(PolicyBodyError);
    expect(() =>
      reconciliationOptions({
        bridgeLimits: {
          absolute: 2,
          relative: null,
          overLimit: 'refuse',
          uncertaintyBudgetId: 'x',
        },
      }),
    ).toThrow(PolicyBodyError);
  });

  it('refuses malformed options', () => {
    expect(() =>
      reconciliationOptions({
        submitGate: { mode: 'stop', codedRatioTarget: 0.95 },
      }),
    ).toThrow(PolicyBodyError);
    expect(() =>
      reconciliationOptions({
        submitGate: { mode: 'block', codedRatioTarget: 95 },
      }),
    ).toThrow(PolicyBodyError);
    expect(() =>
      reconciliationOptions({
        bridgeLimits: { absolute: -1, relative: null, overLimit: 'refuse' },
      }),
    ).toThrow(PolicyBodyError);
    expect(() =>
      reconciliationOptions({ reversibleKinds: ['reversal'] }),
    ).toThrow(PolicyBodyError);
  });
});
