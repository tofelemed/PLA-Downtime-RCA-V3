import { PiRequestError, retryDelayMs } from './pi-http-client';

/** Plan 1.6 (NFR07, PI01): retry waits and failure classification of the PI client. */
describe('PI HTTP client', () => {
  it('honours Retry-After in seconds and as an HTTP date, capped at 60 s', () => {
    expect(retryDelayMs(0, 500, '2')).toBe(2000);
    expect(retryDelayMs(3, 500, '3600')).toBe(60_000);
    const inFive = new Date(Date.now() + 5000).toUTCString();
    expect(retryDelayMs(0, 500, inFive)).toBeLessThanOrEqual(5000);
  });

  it('uses full jitter over an exponential ceiling capped at 10 s', () => {
    expect(retryDelayMs(0, 500, undefined, () => 0.999)).toBe(499);
    expect(retryDelayMs(2, 500, undefined, () => 0.5)).toBe(1000);
    expect(retryDelayMs(10, 500, undefined, () => 0.999)).toBe(9990);
    expect(retryDelayMs(1, 500, undefined, () => 0)).toBe(0);
  });

  it('classifies failures: auth and permission are fatal with a health code, unavailability retries', () => {
    const auth = new PiRequestError('401', 'auth', 401);
    const busy = new PiRequestError('503', 'unavailable', 503);
    expect([auth.code, auth.retryable, auth.health]).toEqual([
      'PI_AUTH_FAILED',
      false,
      'auth_failed',
    ]);
    expect(new PiRequestError('403', 'forbidden', 403).health).toBe(
      'authz_failed',
    );
    expect([busy.retryable, busy.health]).toEqual([true, 'source_unavailable']);
  });
});
