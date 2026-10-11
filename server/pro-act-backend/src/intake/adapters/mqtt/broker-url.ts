import { isIPv6 } from 'net';

/** A parsed, normalised broker endpoint (plan 1.8 design §3: one parser for validation and runtime). */
export interface BrokerUrl {
  scheme: 'mqtt' | 'mqtts';
  /** lower-cased host name or IP; IPv6 without brackets */
  host: string;
  port: number;
  secure: boolean;
  /** `scheme://host:port` with the default port filled in (IPv6 in brackets) */
  normalized: string;
}

export const DEFAULT_BROKER_PORTS: Readonly<Record<'mqtt' | 'mqtts', number>> =
  { mqtt: 1883, mqtts: 8883 };

const LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const BROKER_URL_PATTERN = new RegExp(
  `^(mqtts?)://(?:\\[([0-9A-Fa-f:.]+)\\]|(${LABEL}(?:\\.${LABEL})*))(?::(\\d{1,5}))?$`,
);

/**
 * Parses `mqtt://host[:port]` or `mqtts://host[:port]` (host name, IPv4 or bracketed IPv6; no path,
 * query, credentials or trailing slash). Returns null for anything else.
 */
export function parseBrokerUrl(value: unknown): BrokerUrl | null {
  if (typeof value !== 'string') return null;
  const match = BROKER_URL_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, scheme, ipv6, name, portText] = match as unknown as [
    string,
    'mqtt' | 'mqtts',
    string | undefined,
    string | undefined,
    string | undefined,
  ];
  if (ipv6 !== undefined && !isIPv6(ipv6)) return null;
  const port =
    portText === undefined ? DEFAULT_BROKER_PORTS[scheme] : Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const host = (ipv6 ?? name ?? '').toLowerCase();
  const hostForUrl = ipv6 !== undefined ? `[${host}]` : host;
  return {
    scheme,
    host,
    port,
    secure: scheme === 'mqtts',
    normalized: `${scheme}://${hostForUrl}:${port}`,
  };
}
