import { baselineRecalcScope } from './baseline-recalc-scope';
import { OPEN_ENDED } from './period-recalc';

const FROM = '2027-03-01T00:00:00.000Z';
const TO = '2027-04-01T00:00:00.000Z';
const units = new Map([
  ['profile-1', 'unit-1'],
  ['profile-2', 'unit-2'],
]);

describe('baselineRecalcScope (LA-03)', () => {
  it('a profile change recalculates its unit over the effective interval', () => {
    const scope = baselineRecalcScope(
      'profile-1',
      {
        subject: 'profile',
        unitId: 'unit-1',
        effectiveFrom: FROM,
        effectiveTo: TO,
      },
      { profileUnits: units, importWindow: null },
    );
    expect(scope).toEqual({
      unitIds: ['unit-1'],
      from: new Date(FROM),
      to: new Date(TO),
    });
  });

  it('a rate change finds the unit through its profile; an open-ended rate covers every later period, future ones included', () => {
    const scope = baselineRecalcScope(
      'profile-2',
      { subject: 'rate', effectiveFrom: FROM, effectiveTo: null },
      { profileUnits: units, importWindow: null },
    );
    expect(scope).toEqual({
      unitIds: ['unit-2'],
      from: new Date(FROM),
      to: OPEN_ENDED,
    });
  });

  it('a valuation rate of an impact code (no profile) recalculates every unit of the tenant', () => {
    const scope = baselineRecalcScope(
      'impact-code-9',
      { subject: 'valuation_rate', effectiveFrom: FROM, effectiveTo: TO },
      { profileUnits: units, importWindow: null },
    );
    expect(scope).toEqual({
      unitIds: null,
      from: new Date(FROM),
      to: new Date(TO),
    });
  });

  it('an applied import recalculates the units of its profiles over the imported rates’ window', () => {
    const scope = baselineRecalcScope(
      'import-1',
      { subject: 'rate_import', profileIds: ['profile-1', 'profile-2'] },
      { profileUnits: units, importWindow: { from: new Date(FROM), to: null } },
    );
    expect(scope).toEqual({
      unitIds: ['unit-1', 'unit-2'],
      from: new Date(FROM),
      to: OPEN_ENDED,
    });
  });

  it('nothing to recalculate when the profile or the imported window is unknown', () => {
    expect(
      baselineRecalcScope(
        'missing',
        { subject: 'rate', effectiveFrom: FROM, effectiveTo: TO },
        { profileUnits: units, importWindow: null },
      ),
    ).toBeNull();
    expect(
      baselineRecalcScope(
        'import-2',
        { subject: 'rate_import', profileIds: ['profile-1'] },
        { profileUnits: units, importWindow: null },
      ),
    ).toBeNull();
  });
});
