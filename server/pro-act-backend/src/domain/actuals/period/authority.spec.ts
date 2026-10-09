import { Dec, ZERO } from '../decimal';
import { selectAuthority } from './authority';
import { SourceAuthorityPolicy, SourceCandidate } from './period-actuals.types';

const window = {
  from: new Date('2027-03-01T06:00:00Z'),
  to: new Date('2027-03-01T14:00:00Z'),
};

const policy: SourceAuthorityPolicy = {
  measurement: 'output',
  productId: null,
  primarySource: 'pi_output_ef',
  fallback: {
    conditions: ['primary_stale', 'primary_bad_quality', 'primary_missing'],
    source: 'mqtt',
  },
  cadenceSeconds: 60,
  conflictTolerance: 0,
  overrideRole: 'integration_admin',
};

const candidate = (
  overrides: Partial<SourceCandidate> = {},
): SourceCandidate => ({
  source: 'pi_output_ef',
  method: 'output_events',
  label: 'production_output_events',
  basis: 'gross',
  quantity: new Dec(100),
  reject: null,
  measured: new Dec(100),
  estimated: ZERO,
  uom: 't',
  available: true,
  observed: [{ start: window.from, end: window.to }],
  segments: [],
  findings: [],
  ...overrides,
});

describe('selectAuthority (SRC01, D05, T12)', () => {
  it('T12: primary and fallback both present → primary selected, conflict recorded, never summed', () => {
    const mqtt = candidate({
      source: 'mqtt',
      method: 'counter_delta',
      label: 'signal:m',
      quantity: new Dec(97),
    });
    const selection = selectAuthority(
      policy,
      { candidates: { pi_output_ef: candidate(), mqtt }, ambiguous: [] },
      window,
    );
    expect(selection.role).toBe('primary');
    expect(selection.selected?.quantity?.toString()).toBe('100');
    expect(selection.findings.map((f) => f.code)).toEqual(['source_conflict']);
    expect(selection.findings[0].detail).toMatchObject({
      selectedQuantity: '100',
      otherQuantity: '97',
    });
  });

  it('equal values within tolerance are no conflict', () => {
    const mqtt = candidate({ source: 'mqtt', quantity: new Dec(100.5) });
    const selection = selectAuthority(
      { ...policy, conflictTolerance: 0.01 },
      { candidates: { pi_output_ef: candidate(), mqtt }, ambiguous: [] },
      window,
    );
    expect(selection.findings).toEqual([]);
  });

  it('falls back when the primary has no data (primary_missing)', () => {
    const mqtt = candidate({ source: 'mqtt', quantity: new Dec(90) });
    const selection = selectAuthority(
      policy,
      {
        candidates: {
          pi_output_ef: candidate({
            available: false,
            quantity: null,
            observed: [],
          }),
          mqtt,
        },
        ambiguous: [],
      },
      window,
    );
    expect(selection.role).toBe('fallback');
    expect(selection.selected).toBe(mqtt);
    expect(selection.findings[0]).toMatchObject({
      code: 'fallback_used',
      severity: 'info',
    });
  });

  it('falls back on bad primary quality only when the fallback is complete', () => {
    const partial = candidate({
      quantity: new Dec(50),
      observed: [{ start: window.from, end: new Date('2027-03-01T10:00:00Z') }],
    });
    const complete = candidate({ source: 'mqtt', quantity: new Dec(90) });
    const incomplete = candidate({ source: 'mqtt', quantity: null });
    const set = (mqtt: SourceCandidate) => ({
      candidates: { pi_output_ef: partial, mqtt },
      ambiguous: [],
    });
    expect(selectAuthority(policy, set(complete), window).role).toBe(
      'fallback',
    );
    expect(selectAuthority(policy, set(incomplete), window).role).toBe(
      'primary',
    );
  });

  it('never switches without a configured condition', () => {
    const selection = selectAuthority(
      { ...policy, fallback: null },
      { candidates: { mqtt: candidate({ source: 'mqtt' }) }, ambiguous: [] },
      window,
    );
    expect(selection.selected).toBeNull();
  });

  it('reports ambiguous signals as a problem', () => {
    const selection = selectAuthority(
      policy,
      { candidates: {}, ambiguous: ['mqtt'] },
      window,
    );
    expect(selection.findings[0]).toMatchObject({
      code: 'ambiguous_signal',
      severity: 'problem',
    });
  });
});
