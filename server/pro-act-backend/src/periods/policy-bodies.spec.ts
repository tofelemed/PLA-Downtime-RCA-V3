import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  COVERAGE_GATE_DEFAULT,
  parseCoverageGate,
  parseSourceAuthority,
  PolicyBodyError,
  SOURCE_AUTHORITY_DEFAULT,
} from './policy-bodies';
import {
  OEE_POLICY_DEFAULT,
  parseOeePolicy,
  parseReconciliationTolerance,
  RECONCILIATION_TOLERANCE_DEFAULT,
} from './engine-policy-bodies';

const DEFAULTS_DIR = resolve(
  __dirname,
  '../../../../contracts/policies/defaults',
);

function defaultBody(kind: string): unknown {
  const doc = JSON.parse(
    readFileSync(resolve(DEFAULTS_DIR, `${kind}.default.json`), 'utf8'),
  ) as { body: unknown };
  return doc.body;
}

describe('accounting policy bodies (plan 2.4, D05)', () => {
  it('the seeded defaults equal the contracts defaults', () => {
    expect(COVERAGE_GATE_DEFAULT).toEqual(defaultBody('coverage_gate'));
    expect(SOURCE_AUTHORITY_DEFAULT).toEqual(defaultBody('source_authority'));
  });

  it('parses the defaults unchanged', () => {
    expect(parseCoverageGate(defaultBody('coverage_gate'))).toEqual(
      COVERAGE_GATE_DEFAULT,
    );
    expect(parseSourceAuthority(defaultBody('source_authority'))).toEqual(
      SOURCE_AUTHORITY_DEFAULT,
    );
  });

  it('refuses malformed bodies instead of guessing', () => {
    expect(() =>
      parseCoverageGate({ ...COVERAGE_GATE_DEFAULT, requiredCoverageRatio: 2 }),
    ).toThrow(PolicyBodyError);
    expect(() =>
      parseSourceAuthority({
        ...SOURCE_AUTHORITY_DEFAULT,
        primarySource: 'guess',
      }),
    ).toThrow(PolicyBodyError);
    expect(() =>
      parseSourceAuthority({
        ...SOURCE_AUTHORITY_DEFAULT,
        measurement: 'state',
      }),
    ).toThrow(PolicyBodyError);
  });
});

describe('engine policy bodies (plan 2.5, D04 / D06)', () => {
  it('the seeded defaults equal the contracts defaults and parse unchanged', () => {
    expect(OEE_POLICY_DEFAULT).toEqual(defaultBody('oee_policy'));
    expect(RECONCILIATION_TOLERANCE_DEFAULT).toEqual(
      defaultBody('reconciliation_tolerance'),
    );
    expect(parseOeePolicy(defaultBody('oee_policy'))).toEqual(
      OEE_POLICY_DEFAULT,
    );
    expect(
      parseReconciliationTolerance(defaultBody('reconciliation_tolerance')),
    ).toEqual(RECONCILIATION_TOLERANCE_DEFAULT);
  });

  it('SME D7 (14 Oct 2026): new plants allocate overlapping stops first-out; a version written before the option keeps equal shares', () => {
    expect(OEE_POLICY_DEFAULT.overlapAllocation).toBe('first_out');
    const { overlapAllocation: _omitted, ...beforeTheOption } =
      OEE_POLICY_DEFAULT;
    expect(parseOeePolicy(beforeTheOption).overlapAllocation).toBe(
      'equal_share',
    );
  });

  it('refuses malformed bodies', () => {
    expect(() =>
      parseOeePolicy({ ...OEE_POLICY_DEFAULT, derateComponent: 'quality' }),
    ).toThrow(PolicyBodyError);
    expect(() =>
      parseReconciliationTolerance({
        ...RECONCILIATION_TOLERANCE_DEFAULT,
        epsilon: -1,
      }),
    ).toThrow(PolicyBodyError);
  });
});
