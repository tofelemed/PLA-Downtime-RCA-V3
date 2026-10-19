import { restatementDelta } from '../../../domain/reconciliation/restatement-delta';
import {
  changeSetOf,
  flattenJson,
  headlineOf,
  jsonSpecs,
  pathLabel,
} from './field-diff';
import { deltaSides } from './review-changes';
import { VERSION_CHANGE_KINDS } from './version-changes';

const rateSpecs = () => {
  const specs = VERSION_CHANGE_KINDS.rate.specs;
  return typeof specs === 'function' ? specs({}, null) : specs;
};

describe('approval change sets', () => {
  it('diffs a rate against its approved predecessor with the profile unit over the time base', () => {
    const set = changeSetOf({
      id: 'r2',
      specs: rateSpecs(),
      before: {
        rate: '28.00000000',
        rateKind: 'planning',
        timebase: 'h',
        profileUom: 't',
        effectiveFrom: new Date('2026-09-01T00:00:00Z'),
      },
      after: {
        rate: '29',
        rateKind: 'planning',
        timebase: 'h',
        profileUom: 't',
        effectiveFrom: new Date('2026-10-17T00:00:00Z'),
      },
    });
    expect(set.mode).toBe('diff');
    const rate = set.fields.find((field) => field.key === 'rate');
    expect(rate).toMatchObject({
      before: '28.00000000',
      after: '29',
      unit: 't/h',
      format: 'quantity',
      changed: true,
    });
    expect(set.fields.find((field) => field.key === 'rateKind')?.changed).toBe(
      false,
    );
    expect(
      set.fields.find((field) => field.key === 'effectiveFrom'),
    ).toMatchObject({ after: '2026-10-17T00:00:00.000Z', changed: true });
    expect(headlineOf(set)?.key).toBe('rate');
  });

  it('compares numbers by value, not by their decimal text', () => {
    const set = changeSetOf({
      id: 'x',
      specs: rateSpecs(),
      before: { rate: '28.00000000' },
      after: { rate: '28' },
    });
    expect(set.fields[0].changed).toBe(false);
    expect(headlineOf(set)).toBeNull();
  });

  it('shows the full pending content when there is no predecessor', () => {
    const set = changeSetOf({
      id: 'r1',
      specs: rateSpecs(),
      before: null,
      after: { rate: '28', timebase: 'h', profileUom: 't', source: null },
    });
    expect(set.mode).toBe('full');
    expect(set.beforeLabel).toBeNull();
    expect(
      set.fields.every((field) => field.before === null && !field.changed),
    ).toBe(true);
    expect(set.fields.some((field) => field.key === 'source')).toBe(false);
    expect(headlineOf(set)?.key).toBe('rate');
  });

  it('never counts informational one-sided values as a change', () => {
    const set = changeSetOf({
      id: 'p',
      specs: [
        {
          key: 'value:USD',
          label: 'Loss value',
          format: 'money',
          currency: () => 'USD',
          informational: true,
        },
      ],
      before: { 'value:USD': '120' },
      after: { 'value:USD': null },
    });
    expect(set.fields[0]).toMatchObject({
      before: '120',
      after: null,
      currency: 'USD',
      changed: false,
    });
  });

  it('flattens policy bodies to labelled leaf paths', () => {
    const after = flattenJson(
      {
        defaultView: 'contribution_margin',
        materiality: { threshold: 5, reviewerRoles: ['finance_approver'] },
      },
      'body',
    );
    const before = flattenJson(
      { defaultView: 'economic', materiality: { threshold: 5 } },
      'body',
    );
    expect(after).toEqual({
      'body.defaultView': 'contribution_margin',
      'body.materiality.threshold': 5,
      'body.materiality.reviewerRoles': 'finance_approver',
    });
    const set = changeSetOf({
      id: 'pol',
      specs: jsonSpecs(after, before),
      after,
      before,
    });
    expect(
      set.fields.find((field) => field.key === 'body.defaultView'),
    ).toMatchObject({
      before: 'economic',
      after: 'contribution_margin',
      changed: true,
    });
    expect(
      set.fields.find((field) => field.key === 'body.materiality.threshold')
        ?.changed,
    ).toBe(false);
    expect(pathLabel('materiality.reviewerRoles')).toBe(
      'Materiality › reviewer roles',
    );
  });

  it('turns a restatement delta into totals per unit and the changed loss lines', () => {
    const slice = (attributed: string, residual: string) => ({
      uom: 't',
      target: '100',
      actual: '80',
      gap: '20',
      attributed,
      toleranceAdjustment: '0',
      residual,
    });
    const delta = restatementDelta(
      {
        slices: [slice('15', '5')],
        actuals: [],
        lines: [
          {
            kind: 'availability',
            reasonCodeId: 'rc-1',
            uom: 't',
            quantity: '15',
          },
        ],
      },
      {
        slices: [slice('18', '2')],
        actuals: [],
        lines: [
          {
            kind: 'availability',
            reasonCodeId: 'rc-1',
            uom: 't',
            quantity: '18',
          },
        ],
      },
    );
    const sides = deltaSides(delta);
    const set = changeSetOf({ id: 'rev', ...sides });
    const unaccounted = set.fields.find(
      (field) => field.key === 'figure:t:residual',
    );
    expect(unaccounted).toMatchObject({
      label: 'Unaccounted',
      before: '5',
      after: '2',
      unit: 't',
      changed: true,
    });
    expect(
      set.fields.find((field) => field.key === 'figure:t:target')?.changed,
    ).toBe(false);
    const line = sides.specs.find((spec) => spec.key === 'line:0');
    expect(line).toMatchObject({
      label: 'Availability loss line',
      labelRef: { ref: 'reason-code', id: 'rc-1' },
    });
  });
});
