import { EnvelopeQuality } from '../../envelope/canonical-envelope';
import { QUALITY_PROTOCOLS } from './payload-profile';

/**
 * Source quality → canonical quality (design §4.2 stage 8, OT contract §3.4). One decoder per
 * convention; a missing value is `missing` and an unrecognised one is `uncertain` with the reason —
 * never good. `PI` is the contract default (the PI Web API value flags as an object); the others
 * cover bridged systems the data engineering team may announce (contract §3.4 last sentence).
 */
export type QualityProtocol = (typeof QUALITY_PROTOCOLS)[number];
export type QualityStatus = EnvelopeQuality['status'];

export interface DecodedQuality {
  status: QualityStatus;
  sourceFlags: string[];
  reason: string | null;
}

/** Quality tokens of the STRING_ENUM convention (case-insensitive). */
const STRING_TOKENS: ReadonlyMap<string, QualityStatus> = new Map([
  ['GOOD', 'good'],
  ['OK', 'good'],
  ['UNCERTAIN', 'uncertain'],
  ['QUESTIONABLE', 'uncertain'],
  ['SUBSTITUTED', 'uncertain'],
  ['STALE', 'uncertain'],
  ['UNKNOWN', 'uncertain'],
  ['BAD', 'bad'],
  ['ERROR', 'bad'],
  ['FAILED', 'bad'],
  ['MISSING', 'missing'],
  ['NO_DATA', 'missing'],
  ['NODATA', 'missing'],
  ['NONE', 'missing'],
]);

/** Sparkplug B `Quality` metric property values. */
const SPARKPLUG_CODES: ReadonlyMap<number, QualityStatus> = new Map([
  [192, 'good'],
  [0, 'bad'],
  [500, 'uncertain'],
]);

const DECODERS: Record<QualityProtocol, (raw: unknown) => DecodedQuality> = {
  PI: decodePi,
  STRING_ENUM: decodeStringEnum,
  OPC_DA: decodeOpcDa,
  OPC_UA: decodeOpcUa,
  SPARKPLUG: decodeSparkplug,
  NONE: decodeNone,
};

/** The canonical quality of a raw quality value under a protocol. */
export function decodeQuality(
  protocol: QualityProtocol,
  raw: unknown,
): DecodedQuality {
  if (protocol !== 'NONE' && (raw === undefined || raw === null)) {
    return quality('missing', [], 'no quality value in the message');
  }
  return DECODERS[protocol](raw);
}

/** `EnvelopeQuality` of a decoded quality plus the time flags of the message. */
export function toEnvelopeQuality(
  decoded: DecodedQuality,
  time: { degraded: boolean; flags: string[] },
): EnvelopeQuality {
  const flags = [...decoded.sourceFlags, ...time.flags];
  return {
    status: decoded.status,
    ...(flags.length > 0 ? { sourceFlags: flags } : {}),
    ...(decoded.reason ? { reason: decoded.reason } : {}),
    degraded: time.degraded,
  };
}

/** Contract §3.4: good & !questionable → good; questionable → uncertain; good=false → bad. */
function decodePi(raw: unknown): DecodedQuality {
  if (typeof raw === 'string') return decodeStringEnum(raw);
  if (!isRecord(raw)) return unrecognised(raw);
  const flags = ['questionable', 'substituted', 'annotated'].filter(
    (flag) => raw[flag] === true,
  );
  if (raw.good === false) return quality('bad', flags, null);
  if (raw.questionable === true) return quality('uncertain', flags, null);
  if (raw.good === true) return quality('good', flags, null);
  return quality('uncertain', flags, 'PI flags carry no good indicator');
}

function decodeStringEnum(raw: unknown): DecodedQuality {
  if (typeof raw !== 'string') return unrecognised(raw);
  const token = raw.trim().toUpperCase();
  const status = STRING_TOKENS.get(token);
  if (!status) return unrecognised(raw);
  return quality(status, status === 'good' ? [] : [token.toLowerCase()], null);
}

/** OPC DA quality byte: bits 7–6 are the quality (11 good, 01 uncertain, 00 bad, 10 not used). */
function decodeOpcDa(raw: unknown): DecodedQuality {
  const code = integerOf(raw);
  if (code === null || code < 0 || code > 0xffff) return unrecognised(raw);
  const major = (code >> 6) & 0b11;
  const flag = `opc_da:0x${code.toString(16)}`;
  if (major === 0b11) return quality('good', [], null);
  if (major === 0b01) return quality('uncertain', [flag], null);
  if (major === 0b00) return quality('bad', [flag], null);
  return quality('uncertain', [flag], 'OPC DA quality 10xxxxxx is not used');
}

/** OPC UA StatusCode: the two top bits are the severity (00 good, 01 uncertain, 10/11 bad). */
function decodeOpcUa(raw: unknown): DecodedQuality {
  const code = integerOf(raw);
  if (code === null || code < 0 || code > 0xffffffff) return unrecognised(raw);
  const severity = Math.floor(code / 0x40000000);
  const flag = `opc_ua:0x${code.toString(16).padStart(8, '0')}`;
  if (severity === 0) return quality('good', [], null);
  if (severity === 1) return quality('uncertain', [flag], null);
  return quality('bad', [flag], null);
}

function decodeSparkplug(raw: unknown): DecodedQuality {
  const code = integerOf(isRecord(raw) ? raw.value : raw);
  if (code === null) return unrecognised(raw);
  const status = SPARKPLUG_CODES.get(code);
  if (!status) return unrecognised(raw);
  return quality(status, status === 'good' ? [] : [`sparkplug:${code}`], null);
}

/** A source declared without a quality concept asserts nothing; the value is taken as delivered. */
function decodeNone(): DecodedQuality {
  return quality('good', [], null);
}

function unrecognised(raw: unknown): DecodedQuality {
  return quality(
    'uncertain',
    [],
    `unrecognised quality value ${describe(raw)}`,
  );
}

function quality(
  status: QualityStatus,
  sourceFlags: string[],
  reason: string | null,
): DecodedQuality {
  return { status, sourceFlags, reason };
}

function integerOf(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : null;
  if (typeof raw === 'string' && /^(0x[0-9a-f]+|\d+)$/i.test(raw.trim())) {
    return Number(raw.trim());
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(raw: unknown): string {
  const text = JSON.stringify(raw) ?? String(raw);
  return text.length > 64 ? `${text.slice(0, 61)}...` : text;
}
