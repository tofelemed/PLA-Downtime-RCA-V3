import {
  assertConfirmedDatabase,
  parseCliArgs,
  runMode,
  tenantFlag,
} from './cli-args';

const TENANT = '5f011848-1cb5-4b7c-b75a-8938b46260a9';

describe('cutover CLI arguments (plan 3.10)', () => {
  it('parses a command, valued flags and switches', () => {
    expect(
      parseCliArgs([
        'flags-on',
        '--tenant',
        TENANT,
        '--screens',
        'all',
        '--apply',
      ]),
    ).toEqual({
      command: 'flags-on',
      flags: { tenant: TENANT, screens: 'all', apply: true },
    });
  });

  it('is a dry run unless --apply comes with an actor and the database name', () => {
    expect(runMode(parseCliArgs(['--actor', 'Jane Doe']))).toEqual({
      kind: 'dry-run',
    });
    expect(() => runMode(parseCliArgs(['--apply', '--actor', 'Jane']))).toThrow(
      /confirm-database/,
    );
    expect(
      runMode(
        parseCliArgs([
          '--apply',
          '--actor',
          'Jane',
          '--confirm-database',
          'proact',
        ]),
      ),
    ).toEqual({ kind: 'apply', actor: 'Jane', confirmDatabase: 'proact' });
  });

  it('refuses an apply against a database other than the confirmed one', () => {
    const mode = runMode(
      parseCliArgs([
        '--apply',
        '--actor',
        'Jane',
        '--confirm-database',
        'proact_pilot',
      ]),
    );
    expect(() => assertConfirmedDatabase(mode, 'proact')).toThrow(
      /nothing was written/,
    );
    expect(() => assertConfirmedDatabase(mode, 'proact_pilot')).not.toThrow();
    expect(() =>
      assertConfirmedDatabase({ kind: 'dry-run' }, 'x'),
    ).not.toThrow();
  });

  it('accepts only a uuid tenant (never a name or a default)', () => {
    expect(tenantFlag(parseCliArgs(['--tenant', TENANT]))).toBe(TENANT);
    expect(tenantFlag(parseCliArgs([]))).toBeNull();
    expect(() =>
      tenantFlag(parseCliArgs(['--tenant', 'Demo Plant'])),
    ).toThrow();
  });
});
