import type { ConnectionView } from '@/api/v2/types/integrations';
import { plural } from '@/features/ux-kit/format/plural';

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** One line of where a connection points (never a credential): PI URL or MQTT broker, user, client id. */
export function endpointSummary(connection: ConnectionView): string {
  const config = connection.endpointConfig;
  if (connection.sourceType === 'mqtt') {
    const mqtt = record(config.mqtt);
    const tls = record(mqtt.tls);
    const parts = [text(mqtt.brokerUrl) ?? 'no broker', mqtt.protocolVersion === 4 ? 'MQTT 3.1.1' : 'MQTT 5'];
    if (text(mqtt.username)) parts.push(`user ${text(mqtt.username)}`);
    if (connection.effectiveClientId) parts.push(`client id ${connection.effectiveClientId}`);
    if (tls.mode === 'insecure') parts.push('TLS verification disabled');
    const topics = Array.isArray(mqtt.topics) ? mqtt.topics.length : 0;
    parts.push(plural(topics, 'topic filter', 'topic filters'));
    return parts.join(' · ');
  }
  const parts = [text(config.piWebApiUrl) ?? 'no endpoint'];
  if (text(config.username)) parts.push(`user ${text(config.username)}`);
  if (config.allowInsecureTls === true) parts.push('TLS verification disabled');
  return parts.join(' · ');
}
