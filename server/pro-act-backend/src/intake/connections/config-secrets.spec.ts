import { assertNoSecrets, secretKeyPaths } from './config-secrets';

/** Credentials never sit in endpoint_config, at any depth (integration audit 19 Oct 2026). */
describe('endpoint config secret guard', () => {
  it('finds credential names at the top level and nested', () => {
    expect(
      secretKeyPaths({ piWebApiUrl: 'https://pi', password: 'x' }),
    ).toEqual(['password']);
    expect(
      secretKeyPaths({ auth: { apiKey: 'k' }, list: [{ token: 't' }] }),
    ).toEqual(['auth.apiKey', 'list[0].token']);
  });

  it('ignores MQTT value-map tokens, which are source data', () => {
    expect(
      secretKeyPaths({
        payloadProfile: { valueMaps: { reason: { TOKEN: 'MECH-01' } } },
      }),
    ).toEqual([]);
  });

  it('refuses a nested secret with 422 SECRET_IN_CONFIG', () => {
    expect(() => assertNoSecrets({ auth: { password: 'x' } })).toThrow(
      /auth\.password/,
    );
    expect(() =>
      assertNoSecrets({
        piWebApiUrl: 'https://pi',
        username: 'u',
        allowInsecureTls: false,
      }),
    ).not.toThrow();
  });
});
