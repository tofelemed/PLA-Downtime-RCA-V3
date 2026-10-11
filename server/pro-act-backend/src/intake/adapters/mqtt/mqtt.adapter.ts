import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AdapterError } from '../adapter-error';
import { AdapterRegistry } from '../adapter-registry';
import {
  AdapterHealth,
  ConnectionPeer,
  ConnectionTest,
  ReadPage,
  SourceAdapter,
} from '../adapter.interface';
import { IntegrationConnectionService } from '../../connections/integration-connection.service';
import {
  ConnectionCapabilities,
  IntegrationConnection,
} from '../../entities/integration-connection.entity';
import { SUBSCRIBE_MODE } from '../../jobs/job-lease';
import { assertNoDuplicateFeed } from './duplicate-feed';
import {
  buildMqttClientOptions,
  MqttClientTarget,
} from './mqtt-client-options';
import {
  MqttConnectionConfig,
  parseMqttConfig,
  validateMqttConfig,
} from './mqtt-config';
import { probeBroker, ProbeResult } from './mqtt-probe';

/**
 * MQTT source adapter (plan 1.8 WP3 step 1, MQ01–MQ05). Configuration validation, the duplicate-feed
 * guard, a CONNACK-only connection test with a throwaway client id, discovery of the configured topic
 * filters and health. Subscriptions are long-lived and hosted by the worker (`MqttSubscriberHost`,
 * step 3), so `read()` is refused: an MQTT connection is never a pull job.
 */
@Injectable()
export class MqttAdapter implements SourceAdapter, OnModuleInit {
  readonly sourceType = 'mqtt' as const;
  private readonly logger = new Logger(MqttAdapter.name);

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly connections: IntegrationConnectionService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  capabilities(): ConnectionCapabilities {
    return {
      replay: false,
      corrections: true,
      deletions: true,
      quality: true,
      sourceTimestamps: true,
      sequence: true,
    };
  }

  validateConfig(config: Readonly<Record<string, unknown>>): string[] {
    return validateMqttConfig(config);
  }

  validateAmongPeers(
    config: Readonly<Record<string, unknown>>,
    peers: readonly ConnectionPeer[],
    connectionId: string | null,
  ): void {
    assertNoDuplicateFeed({ endpointConfig: config, connectionId }, peers);
  }

  async test(connection: IntegrationConnection): Promise<ConnectionTest> {
    const prepared = await this.prepare(connection, 'test').catch(
      (error: unknown) => error,
    );
    if (!isPrepared(prepared)) return failedTest(prepared);
    const { config, target } = prepared;
    const result = await probeBroker(
      target,
      {
        protocolVersion: config.mqtt.protocolVersion,
        host: config.broker.host,
        servername: config.mqtt.tls.servername,
      },
      (config.mqtt.connectTimeoutSeconds + 1) * 1000,
    );
    return {
      connected: result.ok,
      message: result.ok
        ? `Connected to ${config.broker.normalized} (MQTT ${config.mqtt.protocolVersion === 5 ? '5' : '3.1.1'})`
        : result.failure.message,
      diagnostics: diagnosticsOf(config, target, result),
    };
  }

  /** The configured topic filters are the discoverable items; brokers cannot be browsed. */
  discover(
    connection: IntegrationConnection,
  ): Promise<Record<string, unknown>> {
    const config = parseMqttConfig(connection.endpointConfig);
    return Promise.resolve({
      broker: config.broker.normalized,
      protocolVersion: config.mqtt.protocolVersion,
      topics: config.mqtt.topics.map((filter) => ({
        filter,
        qos: config.mqtt.qos,
      })),
      availabilityTopic: config.mqtt.availabilityTopic ?? null,
      payloadProfile: config.payloadProfile.kind,
      topicTemplate: config.payloadProfile.topicTemplate,
    });
  }

  read(): Promise<ReadPage> {
    return Promise.reject(
      new AdapterError(
        'MQTT connections are subscriptions hosted by the worker, not pull jobs',
        'NOT_PULLABLE',
        false,
        'not_pullable',
      ),
    );
  }

  async health(connection: IntegrationConnection): Promise<AdapterHealth> {
    const test = await this.test(connection);
    return test.connected
      ? { status: 'ok' }
      : { status: 'down', detail: test.message };
  }

  /** An MQTT job is a subscription hosted by the worker: its scope is `{ mode: 'subscribe' }`. */
  validateScope(
    _connection: IntegrationConnection,
    scope: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    if (scope.mode === SUBSCRIBE_MODE) return Promise.resolve();
    return Promise.reject(
      new AdapterError(
        `MQTT jobs are subscriptions: scope.mode must be "${SUBSCRIBE_MODE}" (the worker creates one per active connection)`,
        'INVALID_JOB_SCOPE',
        false,
        'config_invalid',
      ),
    );
  }

  /** The live clients belong to `MqttSubscriberHost`, which closes them on shutdown. */
  close(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * The configuration, revealed secret and mqtt.js options of a connection, from the one options
   * factory (design §4.2 stage 1): a tested configuration is the one the subscriber host runs.
   */
  async prepare(
    connection: IntegrationConnection,
    purpose: 'test' | 'subscribe',
  ): Promise<Prepared> {
    const config = parseMqttConfig(connection.endpointConfig);
    const [password, caPem] = await Promise.all([
      this.connections.revealSecret(connection),
      config.mqtt.tls.mode === 'caRef' && config.mqtt.tls.caRef
        ? this.connections.revealSecretRef(
            connection.tenantId,
            config.mqtt.tls.caRef,
          )
        : Promise.resolve(null),
    ]);
    const target = buildMqttClientOptions({
      connectionId: connection.id,
      config,
      password,
      caPem,
      purpose,
    });
    if (target.insecureTls) {
      this.logger.warn(
        `MQTT connection ${connection.id} runs with TLS verification disabled (tls.mode insecure)`,
      );
    }
    return { config, target };
  }
}

export interface Prepared {
  config: MqttConnectionConfig;
  target: MqttClientTarget;
}

function isPrepared(value: unknown): value is Prepared {
  return (
    typeof value === 'object' &&
    value !== null &&
    'config' in value &&
    'target' in value
  );
}

function failedTest(error: unknown): ConnectionTest {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof AdapterError ? error.code : 'error';
  return { connected: false, message, diagnostics: { prepare: code } };
}

/** Per-step results for the console; never the password, never the PEM. */
function diagnosticsOf(
  config: MqttConnectionConfig,
  target: MqttClientTarget,
  result: ProbeResult,
): Record<string, unknown> {
  const base = {
    broker: config.broker.normalized,
    protocolVersion: config.mqtt.protocolVersion,
    clientId: target.clientId,
    username: config.mqtt.username ?? null,
    tlsMode: config.broker.secure ? config.mqtt.tls.mode : 'none',
    elapsedMs: result.elapsedMs,
  };
  if (result.ok) {
    return {
      ...base,
      connect: 'ok',
      sessionPresent: result.sessionPresent,
      serverKeepAlive: result.serverKeepAlive ?? null,
      receiveMaximum: result.receiveMaximum ?? null,
      maximumPacketSize: result.maximumPacketSize ?? null,
    };
  }
  return {
    ...base,
    connect: result.failure.kind,
    reasonCode: result.failure.reasonCode ?? null,
    reasonName: result.failure.reasonName ?? null,
    errorCode: result.failure.errorCode ?? null,
    retryable: result.failure.retryable,
  };
}
