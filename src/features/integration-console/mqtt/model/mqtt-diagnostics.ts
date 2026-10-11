import type { ConnectionTestView } from '@/api/v2/types/integrations';

export interface MqttDiagnosticRow {
  key: string;
  label: string;
  value: string;
  tone: 'ok' | 'error' | 'neutral';
}

/** `diagnosticsOf` keys of the MQTT adapter test (`mqtt.adapter.ts`), in display order. */
const LABELS: ReadonlyArray<[key: string, label: string]> = [
  ['prepare', 'Preparation'],
  ['broker', 'Broker'],
  ['protocolVersion', 'Protocol version'],
  ['clientId', 'Client id (throwaway for the test)'],
  ['username', 'User name'],
  ['tlsMode', 'TLS mode'],
  ['connect', 'Connect (CONNACK)'],
  ['sessionPresent', 'Session present'],
  ['serverKeepAlive', 'Server keep-alive'],
  ['receiveMaximum', 'Receive maximum'],
  ['maximumPacketSize', 'Maximum packet size'],
  ['reasonCode', 'Reason code'],
  ['reasonName', 'Reason'],
  ['errorCode', 'Socket error'],
  ['retryable', 'Retryable'],
  ['elapsedMs', 'Elapsed (ms)'],
];

const show = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

function toneOf(key: string, value: unknown): MqttDiagnosticRow['tone'] {
  if (key === 'connect') return value === 'ok' ? 'ok' : 'error';
  if (key === 'prepare') return 'error';
  if (key === 'tlsMode' && value === 'insecure') return 'error';
  return 'neutral';
}

/** One row per reported key (the test never carries the password or the PEM). */
export function mqttDiagnosticRows(test: ConnectionTestView | null): MqttDiagnosticRow[] {
  const raw: Record<string, unknown> = test?.diagnostics ?? {};
  return LABELS.filter(([key]) => key in raw).map(([key, label]) => ({ key, label, value: show(raw[key]), tone: toneOf(key, raw[key]) }));
}

/** MQTT protocol version as the broker negotiated it, for the header line. */
export function protocolLabel(version: unknown): string {
  return version === 4 ? 'MQTT 3.1.1' : 'MQTT 5';
}
