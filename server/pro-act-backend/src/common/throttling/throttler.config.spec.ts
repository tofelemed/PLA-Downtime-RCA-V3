import {
  THROTTLE_DEFAULT_LIMIT,
  THROTTLE_DEFAULT_TTL_MS,
  throttlerOptionsFromEnv,
} from './throttler.config';

describe('throttlerOptionsFromEnv', () => {
  it('defaults to 300 requests per minute', () => {
    expect(throttlerOptionsFromEnv({})).toEqual({
      throttlers: [
        {
          name: 'default',
          ttl: THROTTLE_DEFAULT_TTL_MS,
          limit: THROTTLE_DEFAULT_LIMIT,
        },
      ],
    });
    expect(THROTTLE_DEFAULT_LIMIT).toBe(300);
    expect(THROTTLE_DEFAULT_TTL_MS).toBe(60_000);
  });

  it('reads positive integers from the environment and ignores junk', () => {
    expect(
      throttlerOptionsFromEnv({
        THROTTLE_LIMIT: '50',
        THROTTLE_TTL_MS: '1000',
      }),
    ).toEqual({
      throttlers: [{ name: 'default', ttl: 1000, limit: 50 }],
    });
    expect(
      throttlerOptionsFromEnv({
        THROTTLE_LIMIT: '-1',
        THROTTLE_TTL_MS: 'soon',
      }),
    ).toEqual({
      throttlers: [
        {
          name: 'default',
          ttl: THROTTLE_DEFAULT_TTL_MS,
          limit: THROTTLE_DEFAULT_LIMIT,
        },
      ],
    });
  });
});
