import {
  failedConfigVersionOf,
  recoversAfterConfigChange,
} from './failed-job-recovery';

describe('recoversAfterConfigChange (plan 1.8, failed subscription after a corrected connection)', () => {
  it('restarts a job that failed at an older configuration version', () => {
    expect(
      recoversAfterConfigChange(
        { state: 'failed', health: { configVersion: 1 } },
        2,
      ),
    ).toBe(true);
  });

  it('keeps a job failed at the current version failed (no retry storm)', () => {
    expect(
      recoversAfterConfigChange(
        { state: 'failed', health: { configVersion: 2 } },
        2,
      ),
    ).toBe(false);
    expect(
      recoversAfterConfigChange(
        { state: 'failed', health: { configVersion: 3 } },
        2,
      ),
    ).toBe(false);
  });

  it('restarts once when the failure recorded no version', () => {
    expect(recoversAfterConfigChange({ state: 'failed', health: {} }, 1)).toBe(
      true,
    );
    expect(
      recoversAfterConfigChange(
        { state: 'failed', health: { configVersion: null } },
        1,
      ),
    ).toBe(true);
  });

  it.each(['created', 'running', 'paused', 'draining', 'stopped'] as const)(
    'never touches a %s job',
    (state) => {
      expect(
        recoversAfterConfigChange({ state, health: { configVersion: 1 } }, 5),
      ).toBe(false);
    },
  );

  it('reads only a finite numeric configVersion from the health', () => {
    expect(failedConfigVersionOf({ configVersion: 4 })).toBe(4);
    expect(failedConfigVersionOf({ configVersion: '4' })).toBeNull();
    expect(failedConfigVersionOf({ configVersion: Number.NaN })).toBeNull();
    expect(failedConfigVersionOf({})).toBeNull();
  });
});
