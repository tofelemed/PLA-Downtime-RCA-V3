import {
  ImpactRule,
  ImpactSubject,
  impactChanged,
  isManualImpact,
  resolveUnitImpact,
  StandbyRun,
} from '../../src/domain/reliability/unit-impact';

/**
 * Plan 1.10 step 4 impact fixtures (SME Q5 + D9, ISO 14224 production impact total / partial / none): the
 * feed pump P-101 of an extruder stops 10:00–11:00. Without a rule the unit stops (full stop, unchanged
 * behaviour); a rule "one of two trains" makes it a 50 % derate; with the installed spare P-101B starting
 * within the 60 s takeover window and running past the stop, output holds (`none`, failure without loss);
 * a late or failed start leaves the rule's own impact; a person's stated impact is never replaced.
 */
const at = (hh: number, mm = 0, ss = 0) =>
  new Date(Date.UTC(2027, 2, 1, hh, mm, ss));

const STOP: ImpactSubject = {
  start: at(10),
  end: at(11),
  impactMode: 'full_stop',
  impactFraction: null,
  impactBasis: 'default',
};

const rule = (overrides: Partial<ImpactRule> = {}): ImpactRule => ({
  id: 'rule-1',
  version: 2,
  mode: 'full_stop',
  fraction: null,
  standbyAssetId: null,
  takeoverSeconds: 60,
  ...overrides,
});

const run = (overrides: Partial<StandbyRun> = {}): StandbyRun => ({
  id: 'run-1',
  start: at(10, 0, 40),
  end: at(12),
  outcome: 'success',
  ...overrides,
});

const WITH_STANDBY = rule({ standbyAssetId: 'P-101B' });

describe('unit impact rules (plan 1.10 step 4, SME Q5 + D9)', () => {
  it('no rule in force: the stop stops the unit (default, nothing to change)', () => {
    const resolved = resolveUnitImpact(STOP, null, []);
    expect(resolved).toMatchObject({
      mode: 'full_stop',
      basis: 'default',
      ruleId: null,
    });
    expect(impactChanged(STOP, resolved!)).toBe(false);
  });

  it('a fractional rule (one of two trains) makes the stop a 50 % derate', () => {
    const resolved = resolveUnitImpact(
      STOP,
      rule({ mode: 'fractional', fraction: '0.5' }),
      [],
    );
    expect(resolved).toEqual({
      mode: 'fractional',
      fraction: '0.5',
      basis: 'unit_rule',
      ruleId: 'rule-1',
      ruleVersion: 2,
      standbyRecordId: null,
    });
    expect(impactChanged(STOP, resolved!)).toBe(true);
  });

  it('asset with a standby that starts within 60 s and runs past the stop → none (failure, no loss)', () => {
    expect(resolveUnitImpact(STOP, WITH_STANDBY, [run()])).toMatchObject({
      mode: 'none',
      basis: 'standby_takeover',
      standbyRecordId: 'run-1',
    });
    expect(
      resolveUnitImpact({ ...STOP, end: null }, WITH_STANDBY, [
        run({ end: null }),
      ]),
    ).toMatchObject({
      basis: 'standby_takeover',
    });
  });

  it('a late, failed, short or unrelated standby run leaves the rule’s own impact for the whole stop', () => {
    const cases: StandbyRun[] = [
      run({ start: at(10, 1, 1) }),
      run({ outcome: 'failed_while_running' }),
      run({ end: at(10, 30) }),
      run({ start: at(9, 59) }),
    ];
    for (const r of cases) {
      expect(resolveUnitImpact(STOP, WITH_STANDBY, [r])).toMatchObject({
        mode: 'full_stop',
        basis: 'unit_rule',
      });
    }
    expect(
      resolveUnitImpact({ ...STOP, end: null }, WITH_STANDBY, [run()])?.basis,
    ).toBe('unit_rule');
  });

  it('a stated impact is the manual override: never replaced (also a legacy non-default value)', () => {
    const stated: ImpactSubject = { ...STOP, impactBasis: 'stated' };
    expect(resolveUnitImpact(stated, rule({ mode: 'none' }), [])).toBeNull();
    const legacy: ImpactSubject = { ...STOP, impactMode: 'none' };
    expect(isManualImpact(legacy)).toBe(true);
    expect(resolveUnitImpact(legacy, rule(), [])).toBeNull();
  });

  it('a retired rule returns a rule-derived impact to the default full stop', () => {
    const derived: ImpactSubject = {
      ...STOP,
      impactMode: 'fractional',
      impactFraction: '0.5',
      impactBasis: 'unit_rule',
    };
    const resolved = resolveUnitImpact(derived, null, []);
    expect(resolved).toMatchObject({ mode: 'full_stop', basis: 'default' });
    expect(impactChanged(derived, resolved!)).toBe(true);
  });

  it('resolution is idempotent and independent of run order', () => {
    const runs = [
      run({ id: 'b', start: at(10, 0, 50) }),
      run({ id: 'a', start: at(10, 0, 20) }),
    ];
    const first = resolveUnitImpact(STOP, WITH_STANDBY, runs);
    expect(first?.standbyRecordId).toBe('a');
    expect(resolveUnitImpact(STOP, WITH_STANDBY, [...runs].reverse())).toEqual(
      first,
    );
    const stored: ImpactSubject = {
      ...STOP,
      impactMode: 'none',
      impactBasis: 'standby_takeover',
    };
    expect(
      impactChanged(stored, resolveUnitImpact(stored, WITH_STANDBY, runs)!),
    ).toBe(false);
  });
});
