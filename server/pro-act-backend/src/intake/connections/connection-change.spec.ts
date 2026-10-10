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

  it('refuses non-web schemes, username, unknown keys and removed keys without the credential', () => {
    const mqtt = {
      endpointConfig: { brokerUrl: 'mqtt://broker.plant.local' },
      secretRef: 'secrets:2',
    };
    expect(() =>
      assertSecretFollowsTarget(mqtt, {
        endpointConfig: { brokerUrl: 'mqtt://evil.example' },
      }),
    ).toThrow(UnprocessableEntityException);
    const opc = {
      endpointConfig: { endpoint: { url: 'opc.tcp://plc.plant.local:4840' } },
      secretRef: 'secrets:3',
    };
    expect(() =>
      assertSecretFollowsTarget(opc, {
        endpointConfig: { endpoint: { url: 'opc.tcp://evil.example:4840' } },
      }),
    ).toThrow(UnprocessableEntityException);
    refuses({
      endpointConfig: { ...stored.endpointConfig, username: 'other' },
    });
    refuses({
      endpointConfig: { ...stored.endpointConfig, rejectUnauthorized: false },
    });
    refuses({ endpointConfig: { pageSize: 100 } });
    refuses({
      endpointConfig: {
        ...stored.endpointConfig,
        piWebApiUrl: 'https://pi.plant.local/piwebapi/v2',
      },
    });
  });

  it('allows paging/timing edits, renames, and changes that re-enter the secret', () => {
    allows({ endpointConfig: { ...stored.endpointConfig, pageSize: 500 } });
    allows({ endpointConfig: { ...stored.endpointConfig, timeoutMs: 60000 } });
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
