import { swaggerEnabled } from './swagger-enabled';

describe('swaggerEnabled', () => {
  it('is on outside production and off in production by default', () => {
    expect(swaggerEnabled({})).toBe(true);
    expect(swaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('follows FORGE_SWAGGER when it is set', () => {
    expect(
      swaggerEnabled({ NODE_ENV: 'production', FORGE_SWAGGER: 'true' }),
    ).toBe(true);
    expect(swaggerEnabled({ FORGE_SWAGGER: 'false' })).toBe(false);
  });
});
