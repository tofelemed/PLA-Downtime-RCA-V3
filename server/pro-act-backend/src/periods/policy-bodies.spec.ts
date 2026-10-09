import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  COVERAGE_GATE_DEFAULT,
  parseCoverageGate,
  parseSourceAuthority,
  PolicyBodyError,
  SOURCE_AUTHORITY_DEFAULT,
} from './policy-bodies';

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
