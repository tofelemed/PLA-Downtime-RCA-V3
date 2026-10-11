import * as mqtt from 'mqtt';
import { classifyConnectError, ConnectFailure } from './mqtt-connack';
import { MqttClientTarget } from './mqtt-client-options';

export interface ProbeSuccess {
  ok: true;
  elapsedMs: number;
  sessionPresent: boolean;
  /** MQTT 5 CONNACK properties the broker announced (keepalive override, in-flight window ...) */
  serverKeepAlive?: number;
  receiveMaximum?: number;
  maximumPacketSize?: number;
  assignedClientIdentifier?: string;
}

export interface ProbeFailed {
  ok: false;
  elapsedMs: number;
  failure: ConnectFailure;
}

export type ProbeResult = ProbeSuccess | ProbeFailed;

/**
 * Connects once, waits for the CONNACK (or an error / the timeout) and disconnects: nothing is
 * subscribed or published. `timeoutMs` is the hard stop above mqtt.js's own `connectTimeout`.
 */
export function probeBroker(
  target: MqttClientTarget,
  context: { protocolVersion: 4 | 5; host: string; servername?: string },
  timeoutMs: number,
): Promise<ProbeResult> {
  const started = Date.now();
  const client = mqtt.connect(target.url, {
    ...target.options,
    manualConnect: true,
    reconnectPeriod: 0,
  });
  return new Promise<ProbeResult>((resolve) => {
    let settled = false;
    const finish = (result: ProbeResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.removeAllListeners('error');
      client.on('error', () => undefined);
      void client.endAsync(true).catch(() => undefined);
      resolve(result);
    };
    const timer = setTimeout(
      () =>
        finish({
          ok: false,
          elapsedMs: Date.now() - started,
          failure: {
            kind: 'timeout',
            message: `Broker did not answer within ${Math.round(timeoutMs / 1000)} s`,
            retryable: true,
          },
        }),
      timeoutMs,
    );
    client.once('connect', (connack) => {
      const properties = connack.properties ?? {};
      finish({
        ok: true,
        elapsedMs: Date.now() - started,
        sessionPresent: connack.sessionPresent,
        serverKeepAlive: properties.serverKeepAlive,
        receiveMaximum: properties.receiveMaximum,
        maximumPacketSize: properties.maximumPacketSize,
        assignedClientIdentifier: properties.assignedClientIdentifier,
      });
    });
    client.on('error', (error: unknown) => {
      finish({
        ok: false,
        elapsedMs: Date.now() - started,
        failure: classifyConnectError(error, context),
      });
    });
    // mqtt.js closes the stream without an error for some protocol-level refusals (e.g. a CONNECT the
    // broker drops); an `error` with a code, when there is one, has already settled the probe by now
    client.once('close', () => {
      finish({
        ok: false,
        elapsedMs: Date.now() - started,
        failure: {
          kind: 'error',
          message:
            'Connection closed before CONNACK: the broker dropped the CONNECT (check protocol version, credentials and TLS)',
          retryable: false,
        },
      });
    });
    client.connect();
  });
}
