import { UnprocessableEntityException } from '@nestjs/common';
import { assertSecretFollowsTarget } from './connection-change';

const stored = {
  endpointConfig: {
    piWebApiUrl: 'https://pi.plant.local/piwebapi',
    pageSize: 100,
  },
  secretRef: 'secrets:1',
};

describe('assertSecretFollowsTarget', () => {
  const refuses = (change: Parameters<typeof assertSecretFollowsTarget>[1]) =>
    expect(() => assertSecretFollowsTarget(stored, change)).toThrow(
      UnprocessableEntityException,
    );
  const allows = (change: Parameters<typeof assertSecretFollowsTarget>[1]) =>
    expect(() => assertSecretFollowsTarget(stored, change)).not.toThrow();

  it('refuses a new target origin without the credential', () => {
    refuses({
      endpointConfig: {
        ...stored.endpointConfig,
        piWebApiUrl: 'https://evil.example/piwebapi',
      },
    });
    refuses({
      endpointConfig: {
        ...stored.endpointConfig,
        piWebApiUrl: 'https://pi.plant.local:8443/piwebapi',
      },
    });
  });

  it('refuses switching TLS verification off without the credential', () => {
    refuses({
      endpointConfig: { ...stored.endpointConfig, allowInsecureTls: true },
    });
  });

  it('allows non-target edits, path changes on the same origin, and changes that re-enter the secret', () => {
    allows({ endpointConfig: { ...stored.endpointConfig, pageSize: 500 } });
    allows({
      endpointConfig: {
        ...stored.endpointConfig,
        piWebApiUrl: 'https://pi.plant.local/piwebapi/v2',
      },
    });
    allows({ displayName: 'renamed' });
    allows({
      endpointConfig: { piWebApiUrl: 'https://other.plant.local/piwebapi' },
      secret: 'new',
    });
  });

  it('does not apply when no credential is stored', () => {
    expect(() =>
      assertSecretFollowsTarget(
        { endpointConfig: stored.endpointConfig, secretRef: null },
        { endpointConfig: { piWebApiUrl: 'https://other.plant.local' } },
      ),
    ).not.toThrow();
  });
});
