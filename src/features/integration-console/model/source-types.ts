import type { SourceType } from '@/api/v2/types/integrations';

export type SourceAvailability = 'available' | 'scheduled' | 'planned';

export interface SourceTypeOption {
  type: SourceType;
  label: string;
  availability: SourceAvailability;
  /** what the console offers, or why it offers nothing yet */
  description: string;
}

/**
 * Source types of the console (plan 3.7). PI Web API and MQTT (plan 1.8) have adapters; the Kafka
 * adapter is scheduled last (decision D10, plan 1.9), so it is shown as not available instead of with
 * controls that would do nothing; other protocols are planned for release 2.
 */
export const SOURCE_TYPE_OPTIONS: readonly SourceTypeOption[] = [
  {
    type: 'pi_web_api',
    label: 'PI Web API',
    availability: 'available',
    description: 'AF event frames and typed signals through the certified PI Web API adapter.',
  },
  {
    type: 'mqtt',
    label: 'MQTT',
    availability: 'available',
    description: 'Broker subscription hosted by the worker (persist before ack): broker, TLS, topic filters, payload profile and identity strategy.',
  },
  {
    type: 'kafka',
    label: 'Kafka',
    availability: 'scheduled',
    description: 'Not available yet: the Kafka source adapter comes last. Brokers, consumer group, security, decoder and offset policy are configured here once it ships.',
  },
  {
    type: 'opc_ua',
    label: 'OPC UA and other protocols',
    availability: 'planned',
    description: 'Planned as server-side adapters in a later release. Until then, plant data reaches Pro-Act through PI or MQTT.',
  },
];

const LABELS: Partial<Record<SourceType, string>> = {
  pi_web_api: 'PI Web API',
  mqtt: 'MQTT',
  kafka: 'Kafka',
  opc_ua: 'OPC UA',
  rest_import: 'REST import',
  file_import: 'File import',
  db_import: 'Database import',
  manual: 'Manual',
};

export function sourceTypeLabel(type: SourceType): string {
  return LABELS[type] ?? type;
}

/** Whether the console can configure, test and run this source type today. */
export function isSourceSupported(type: SourceType): boolean {
  return SOURCE_TYPE_OPTIONS.some((option) => option.type === type && option.availability === 'available');
}
