import { FEATURE_FLAG_KEYS } from '../../feature-flags/feature-flag-keys';
import { isFreezableV1Path } from './legacy-write-freeze.interceptor';
import { CUTOVER_SCREEN_ORDER, resolveScreenKeys } from './screen-order';

describe('cutover screen order (plan 3.10, C4)', () => {
  it('covers every registered v2 screen flag exactly once', () => {
    expect([...CUTOVER_SCREEN_ORDER].sort()).toEqual(
      [...FEATURE_FLAG_KEYS].sort(),
    );
  });

  it('enables master data before events and the dashboards, and rolls back in reverse', () => {
    const on = resolveScreenKeys('all', true);
    expect(on.indexOf('v2.codesAdmin')).toBeLessThan(on.indexOf('v2.eventHub'));
    expect(on.indexOf('v2.plansProfilesCalendars')).toBeLessThan(
      on.indexOf('v2.planDashboard'),
    );
    expect(resolveScreenKeys('all', false)).toEqual([...on].reverse());
  });

  it('orders a partial selection and rejects unknown keys', () => {
    expect(resolveScreenKeys('v2.rca, v2.eventHub', true)).toEqual([
      'v2.eventHub',
      'v2.rca',
    ]);
    expect(() => resolveScreenKeys('v2.eventHub,v2.nope', true)).toThrow(
      /v2\.nope/,
    );
    expect(() => resolveScreenKeys(' ', true)).toThrow();
  });
});

describe('isFreezableV1Path (MIG05 freeze scope)', () => {
  it.each([
    ['/api/production-events/123', true],
    ['/api/reconcile-forms', true],
    ['/api/v2/production-events', false],
    ['/api/v2', false],
    ['/api/auth/login', false],
    ['/api/authors', true],
    ['/health', false],
  ])('%s → %p', (path, frozen) => {
    expect(isFreezableV1Path(path)).toBe(frozen);
  });
});
