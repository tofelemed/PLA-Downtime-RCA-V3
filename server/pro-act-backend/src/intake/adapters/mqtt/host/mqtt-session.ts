import * as mqtt from 'mqtt';
import { IPublishPacket, MqttClient } from 'mqtt';
import { MqttClientTarget } from '../mqtt-client-options';
import { classifyConnectError, ConnectFailure } from '../mqtt-connack';

/** How a session is closed: `keep` = clean DISCONNECT (broker queues), `drop` = session discarded, `abort` = socket torn down, no DISCONNECT. */
export type DisconnectMode = 'keep' | 'drop' | 'abort';

export interface SessionCallbacks {
  onConnect(connack: { sessionPresent: boolean }): void;
  /** the socket is gone; `failure` is the last error seen (null for a clean close) */
  onClose(input: {
    intentional: boolean;
    failure: ConnectFailure | null;
  }): void;
  /** one inbound QoS 1 / 2 message; `done` sends the PUBACK (persist-before-ack, MQ04) */
  onMessage(packet: IPublishPacket, done: () => void): void;
}

export interface SessionContext {
  protocolVersion: 4 | 5;
  host: string;
  servername?: string;
}

/**
 * ONE mqtt.js client of one connection, built from the step-1 options factory (design §4.2 stage 1).
 * Reconnects are the subscription's job (exponential backoff with jitter), so mqtt.js's own fixed-period
 * reconnect is off; `handleMessage` is overridden so the broker's PUBACK waits for `done`.
 */
export class MqttSession {
  private client: MqttClient | null = null;
  private closing = false;
  private lastFailure: ConnectFailure | null = null;

  constructor(
    private readonly target: MqttClientTarget,
    private readonly context: SessionContext,
    private readonly callbacks: SessionCallbacks,
  ) {}

  get connected(): boolean {
    return this.client?.connected ?? false;
  }

  connect(): void {
    const client = mqtt.connect(this.target.url, {
      ...this.target.options,
      manualConnect: true,
      reconnectPeriod: 0,
    });
    this.client = client;
    client.handleMessage = (packet, done) => {
      if (packet.cmd !== 'publish') return done();
      this.callbacks.onMessage(packet, () => done());
    };
    client.on('connect', (connack) => {
      this.lastFailure = null;
      this.callbacks.onConnect({ sessionPresent: connack.sessionPresent });
    });
    client.on('error', (error: unknown) => {
      this.lastFailure = classifyConnectError(error, this.context);
    });
    client.once('close', () => {
      const intentional = this.closing;
      this.client = null;
      this.closing = false;
      this.callbacks.onClose({ intentional, failure: this.lastFailure });
    });
    client.connect();
  }

  async subscribe(
    topics: ReadonlyArray<{ topic: string; qos: 0 | 1 | 2 }>,
  ): Promise<void> {
    const client = this.requireClient();
    const grants = await client.subscribeAsync(
      Object.fromEntries(
        topics.map((entry) => [entry.topic, { qos: entry.qos }]),
      ),
    );
    const refused = grants.filter((grant) => grant.qos === 128);
    if (refused.length > 0) {
      throw new Error(
        `Broker refused subscription to ${refused.map((grant) => grant.topic).join(', ')} (check the ACL)`,
      );
    }
  }

  async unsubscribe(topics: readonly string[]): Promise<void> {
    if (topics.length === 0 || !this.client?.connected) return;
    await this.client.unsubscribeAsync([...topics]);
  }

  /** Closes the session; resolves once the socket is gone. Safe to call when already closed. */
  async disconnect(mode: DisconnectMode): Promise<void> {
    const client = this.client;
    if (!client) return;
    this.closing = true;
    if (mode === 'abort') {
      await client.endAsync(true);
      return;
    }
    if (mode === 'drop' && this.context.protocolVersion === 5) {
      await client.endAsync(false, {
        reasonCode: 0,
        properties: { sessionExpiryInterval: 0 },
      });
      return;
    }
    await client.endAsync(false);
    // MQTT 3.1.1 has no session expiry: a clean-session connect with the same id discards the session
    if (mode === 'drop') await this.discardSession311();
  }

  private requireClient(): MqttClient {
    if (!this.client) throw new Error('MQTT session is not connected');
    return this.client;
  }

  private discardSession311(): Promise<void> {
    return new Promise((resolve) => {
      const client = mqtt.connect(this.target.url, {
        ...this.target.options,
        clean: true,
        manualConnect: true,
        reconnectPeriod: 0,
      });
      const finish = (): void => {
        void client.endAsync(true).finally(resolve);
      };
      client.once('connect', finish);
      client.once('error', finish);
      client.once('close', () => resolve());
      client.connect();
    });
  }
}
