import type { ConnectionView } from '@/api/v2/types/integrations';
import { plural } from '@/features/ux-kit/format/plural';

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * One line of where a connection points (never a credential): PI URL or MQTT broker, user, and a client id
 * only when the plant set its own (QA L24: the derived `proact-<connection id>` is an internal identifier).
 */
export function endpointSummary(connection: ConnectionView): string {
  const config = connection.endpointConfig;
  if (connection.sourceType === 'mqtt') {
    const mqtt = record(config.mqtt);
    const tls = record(mqtt.tls);
    const parts = [text(mqtt.brokerUrl) ?? 'no broker', mqtt.protocolVersion === 4 ? 'MQTT 3.1.1' : 'MQTT 5'];
    if (text(mqtt.username)) parts.push(`user ${text(mqtt.username)}`);
    if (text(mqtt.clientId)) parts.push(`client id ${text(mqtt.clientId)}`);
    if (tls.mode === 'insecure') parts.push('TLS verification disabled');
    const profile = record(config.payloadProfile);
    const feeds = profile.kind === 'feeds' && Array.isArray(profile.feeds) ? profile.feeds.map(record) : null;
    if (feeds) {
      // feeds mode: the feed topics are subscribed (PLA / downtime per topic)
      const purposes = feeds.map((feed) => (feed.purpose === 'pla' ? 'PLA' : 'downtime'));
      parts.push(`${plural(feeds.length, 'feed', 'feeds')} (${purposes.join(', ')})`);
      return parts.join(' · ');
    }
    const topics = Array.isArray(mqtt.topics) ? mqtt.topics.length : 0;
    parts.push(plural(topics, 'topic filter', 'topic filters'));
    return parts.join(' · ');
  }
  const parts = [text(config.piWebApiUrl) ?? 'no endpoint'];
  if (text(config.username)) parts.push(`user ${text(config.username)}`);
  if (config.allowInsecureTls === true) parts.push('TLS verification disabled');
  return parts.join(' · ');
}
