import type { IClientOptions } from 'mqtt';
import { isEgressAllowed } from '../../../common/security/egress-allowlist';
import { AdapterError } from '../adapter-error';
import { effectiveClientId, MqttConnectionConfig } from './mqtt-config';

/** `test`: throwaway id, clean session, CONNACK only. `subscribe`: the stable persistent session. */
export type MqttClientPurpose = 'test' | 'subscribe';

export interface MqttClientOptionsInput {
  connectionId: string;
  config: MqttConnectionConfig;
  /** the revealed connection secret (broker password), null when the connection has none */
  password: string | null;
  /** the PEM behind `tls.mode = caRef`, resolved by the caller; ignored in other modes */
  caPem?: string | null;
  purpose: MqttClientPurpose;
  /** clock for the throwaway test id (tests) */
  now?: () => number;
}

export interface MqttClientTarget {
  url: string;
  options: IClientOptions;
  clientId: string;
  /** true when certificate verification is off (`tls.mode = insecure`): the caller logs it */
  insecureTls: boolean;
}

/**
 * The ONE place mqtt.js connect options are built from a connection (design §4.2 step 1): shared by
 * `MqttAdapter.test()` and the subscriber host so a tested configuration is the one that runs. Refuses
 * brokers outside `CONNECTOR_EGRESS_ALLOWLIST` with the non-retryable `egress_denied` error.
 */
export function buildMqttClientOptions(
  input: MqttClientOptionsInput,
): MqttClientTarget {
  const { mqtt, broker } = input.config;
  if (!isEgressAllowed(broker.normalized)) {
    throw new AdapterError(
      `${broker.host}:${broker.port} is not in CONNECTOR_EGRESS_ALLOWLIST`,
      'egress_denied',
      false,
      'egress_denied',
    );
  }
  const test = input.purpose === 'test';
  const clientId = test
    ? `test-${(input.now ?? Date.now)()}`
    : effectiveClientId(mqtt.clientId, input.connectionId);
  const options: IClientOptions = {
    clientId,
    protocolVersion: mqtt.protocolVersion,
    clean: test ? true : mqtt.cleanStart,
    keepalive: mqtt.keepaliveSeconds,
    connectTimeout: mqtt.connectTimeoutSeconds * 1000,
    reconnectPeriod: test ? 0 : mqtt.reconnect.minSeconds * 1000,
    resubscribe: false,
    manualConnect: true,
  };
  if (mqtt.protocolVersion === 5) {
    options.properties = {
      sessionExpiryInterval: test ? 0 : mqtt.sessionExpirySeconds,
    };
  }
  if (mqtt.username !== undefined) options.username = mqtt.username;
  if (input.password !== null) {
    // MQTT 3.1.1 forbids a password without a user name and mqtt.js then closes the stream silently
    if (mqtt.username === undefined) {
      throw new AdapterError(
        'A broker password is stored but mqtt.username is not set',
        'PASSWORD_WITHOUT_USERNAME',
        false,
        'config_invalid',
      );
    }
    options.password = input.password;
  }
  const insecureTls = broker.secure && applyTls(options, input);
  return { url: broker.normalized, options, clientId, insecureTls };
}

/** TLS trust per mode; returns true when verification is disabled. */
function applyTls(
  options: IClientOptions,
  input: MqttClientOptionsInput,
): boolean {
  const { tls } = input.config.mqtt;
  options.rejectUnauthorized = tls.mode !== 'insecure';
  if (tls.servername) options.servername = tls.servername;
  if (tls.mode === 'caPem' && tls.caPem) options.ca = [tls.caPem];
  if (tls.mode === 'caRef') {
    if (!input.caPem) {
      throw new AdapterError(
        `CA certificate ${tls.caRef ?? ''} could not be resolved`,
        'CA_REF_UNRESOLVED',
        false,
        'config_invalid',
      );
    }
    options.ca = [input.caPem];
  }
  return tls.mode === 'insecure';
}
