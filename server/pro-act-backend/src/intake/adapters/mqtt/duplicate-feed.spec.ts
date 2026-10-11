import { AdapterError } from '../adapter-error';
import { assertNoDuplicateFeed, findDuplicateFeed } from './duplicate-feed';
import { exampleMqttConfig } from './mqtt-config.example';

const peer = (
  id: string,
  mqtt: Record<string, unknown>,
): {
  id: string;
  displayName: string;
  endpointConfig: Record<string, unknown>;
} => ({
  id,
  displayName: `Feed ${id}`,
  endpointConfig: exampleMqttConfig({ mqtt }),
});

describe('duplicate-feed guard (design §3, CHG-062)', () => {
  const candidate = (
    mqtt: Record<string, unknown>,
    connectionId: string | null = null,
  ) => ({
    endpointConfig: exampleMqttConfig({ mqtt }),
    connectionId,
  });

  it('flags the same normalised endpoint with an overlapping topic filter', () => {
    const peers = [peer('p1', { topics: ['proact/v1/HDPE/#'] })];
    expect(
      findDuplicateFeed(
        candidate({ brokerUrl: 'mqtts://BROKER.plant.local' }),
        peers,
      ),
    ).toMatchObject({
      peerId: 'p1',
      reason: 'overlapping_topics',
      detail: 'proact/v1/+/+/+/+/events overlaps proact/v1/HDPE/#',
    });
  });

  it('ignores other endpoints, disjoint filters, itself and peers without a parsable broker', () => {
    expect(
      findDuplicateFeed(
        candidate({ brokerUrl: 'mqtts://broker.plant.local:8884' }),
        [peer('p1', {})],
      ),
    ).toBeNull();
    expect(
      findDuplicateFeed(candidate({ brokerUrl: 'mqtt://broker.plant.local' }), [
        peer('p1', {}),
      ]),
    ).toBeNull();
    expect(
      findDuplicateFeed(candidate({ topics: ['proact/v1/+/+/+/+/state'] }), [
        peer('p1', {}),
      ]),
    ).toBeNull();
    expect(findDuplicateFeed(candidate({}, 'p1'), [peer('p1', {})])).toBeNull();
    expect(
      findDuplicateFeed(candidate({}), [peer('p1', { brokerUrl: 'garbage' })]),
    ).toBeNull();
    expect(
      findDuplicateFeed(candidate({}), [
        {
          id: 'p2',
          displayName: 'legacy',
          endpointConfig: { brokerUrl: 'mqtt://x' },
        },
      ]),
    ).toBeNull();
  });

  it('flags the same effective client id on the same endpoint even with disjoint topics', () => {
    const disjoint = { topics: ['proact/v1/+/+/+/+/state'] };
    expect(
      findDuplicateFeed(candidate({ ...disjoint, clientId: 'proact-line1' }), [
        peer('p1', { clientId: 'proact-line1' }),
      ]),
    ).toMatchObject({ peerId: 'p1', reason: 'same_client_id' });
    // an explicit id equal to a peer's derived id
    expect(
      findDuplicateFeed(candidate({ ...disjoint, clientId: 'proact-p1' }), [
        peer('p1', {}),
      ]),
    ).toMatchObject({ reason: 'same_client_id' });
    // derived ids are unique per connection
    expect(
      findDuplicateFeed(candidate(disjoint, 'c2'), [peer('p1', {})]),
    ).toBeNull();
    expect(findDuplicateFeed(candidate(disjoint), [peer('p1', {})])).toBeNull();
  });

  it('throws the non-retryable DUPLICATE_FEED error naming the other connection', () => {
    let caught: unknown;
    try {
      assertNoDuplicateFeed(candidate({}), [peer('p1', {})]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AdapterError);
    expect(caught).toMatchObject({
      code: 'DUPLICATE_FEED',
      retryable: false,
      message: expect.stringContaining('"Feed p1" (p1)') as string,
    });
    expect(() => assertNoDuplicateFeed(candidate({}), [])).not.toThrow();
  });
});
