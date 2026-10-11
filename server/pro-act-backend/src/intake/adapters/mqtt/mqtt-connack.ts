/**
 * CONNACK reason codes (MQTT 5.0 §3.2.2.2) and 3.1.1 return codes (§3.2.2.3), and the classification
 * of a failed connection attempt into operator-readable messages without secrets.
 */
export const MQTT5_CONNACK_REASONS: Readonly<Record<number, string>> = {
  0x80: 'UnspecifiedError',
  0x81: 'MalformedPacket',
  0x82: 'ProtocolError',
  0x83: 'ImplementationSpecificError',
  0x84: 'UnsupportedProtocolVersion',
  0x85: 'ClientIdentifierNotValid',
  0x86: 'BadUserNameOrPassword',
  0x87: 'NotAuthorized',
  0x88: 'ServerUnavailable',
  0x89: 'ServerBusy',
  0x8a: 'Banned',
  0x8c: 'BadAuthenticationMethod',
  0x90: 'TopicNameInvalid',
  0x95: 'PacketTooLarge',
  0x97: 'QuotaExceeded',
  0x99: 'PayloadFormatInvalid',
  0x9a: 'RetainNotSupported',
  0x9b: 'QoSNotSupported',
  0x9c: 'UseAnotherServer',
  0x9d: 'ServerMoved',
  0x9f: 'ConnectionRateExceeded',
};

export const MQTT311_CONNACK_RETURNS: Readonly<Record<number, string>> = {
  1: 'UnacceptableProtocolVersion',
  2: 'IdentifierRejected',
  3: 'ServerUnavailable',
  4: 'BadUserNameOrPassword',
  5: 'NotAuthorized',
};

/** Reason codes that mean "fix the configuration", not "try again later". */
const NON_RETRYABLE_REASONS: ReadonlySet<string> = new Set([
  'UnsupportedProtocolVersion',
  'ClientIdentifierNotValid',
  'BadUserNameOrPassword',
  'NotAuthorized',
  'Banned',
  'BadAuthenticationMethod',
  'IdentifierRejected',
  'UnacceptableProtocolVersion',
]);

const TLS_ERROR_CODES: ReadonlySet<string> = new Set([
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ERR_SSL_WRONG_VERSION_NUMBER',
  'EPROTO',
]);

const UNREACHABLE_CODES: ReadonlySet<string> = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
  'ECONNRESET',
  'EPIPE',
]);

export type ConnectFailureKind =
  | 'refused'
  | 'tls'
  | 'unreachable'
  | 'timeout'
  | 'error';

export interface ConnectFailure {
  kind: ConnectFailureKind;
  message: string;
  retryable: boolean;
  reasonCode?: number;
  reasonName?: string;
  errorCode?: string;
}

export function connackReasonName(
  protocolVersion: 4 | 5,
  code: number,
): string {
  const table =
    protocolVersion === 5 ? MQTT5_CONNACK_REASONS : MQTT311_CONNACK_RETURNS;
  return table[code] ?? `0x${code.toString(16)}`;
}

function codeOf(error: unknown): string | number | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' || typeof code === 'number'
    ? code
    : undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Classifies an mqtt.js / socket / TLS error of a connection attempt. */
export function classifyConnectError(
  error: unknown,
  context: { protocolVersion: 4 | 5; host: string; servername?: string },
): ConnectFailure {
  const code = codeOf(error);
  const message = messageOf(error);
  if (typeof code === 'number') {
    const reasonName = connackReasonName(context.protocolVersion, code);
    return {
      kind: 'refused',
      message: `Broker refused connection: ${reasonName}`,
      retryable: !NON_RETRYABLE_REASONS.has(reasonName),
      reasonCode: code,
      reasonName,
    };
  }
  if (typeof code === 'string' && TLS_ERROR_CODES.has(code)) {
    const name = context.servername ?? context.host;
    return {
      kind: 'tls',
      message:
        `TLS handshake failed (${code}): the broker certificate is not trusted or its SAN does not list ` +
        `"${name}"; set tls.servername to a name the certificate lists, or provide its CA (tls.mode caPem / caRef)`,
      retryable: false,
      errorCode: code,
    };
  }
  if (typeof code === 'string' && UNREACHABLE_CODES.has(code)) {
    return {
      kind: 'unreachable',
      message: `Broker unreachable: ${message}`,
      retryable: true,
      errorCode: code,
    };
  }
  if (/timeout/i.test(message)) {
    return {
      kind: 'timeout',
      message: `Broker did not answer: ${message}`,
      retryable: true,
    };
  }
  return {
    kind: 'error',
    message: `Connection failed: ${message}`,
    retryable: true,
    errorCode: typeof code === 'string' ? code : undefined,
  };
}
