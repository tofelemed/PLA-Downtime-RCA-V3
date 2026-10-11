import { EnvelopeQuality } from '../../../envelope/canonical-envelope';
import {
  decodeFailure,
  DecodeFailure,
  DecodeInput,
  DecodeRawRef,
} from '../decode-result';
import { PickedMessage } from '../decode-stages';
import { CommonFields, commonFieldsOf } from '../envelope-base';
import { IdentityResult } from '../identity';
import { PayloadProfileKind } from '../payload-profile';
import {
  decodeQuality,
  QualityProtocol,
  toEnvelopeQuality,
} from '../quality-decoder';
import { resolveEventTime, timeRulesOf } from '../time-rules';
import { ValueMapResult } from '../value-maps';

/** Time and quality, decoded the same way by every profile (design stages 8 and 9). */
export interface DecodedTiming {
  common: CommonFields;
  at: Date;
  observedAt: string;
  quality: EnvelopeQuality;
}

const PROTOCOL_DEFAULT: Record<PayloadProfileKind, QualityProtocol> = {
  interval_event_json: 'PI',
  measurement_json: 'PI',
  state_json: 'PI',
  availability: 'NONE',
};

export function decodeTiming(
  input: DecodeInput,
  picked: PickedMessage,
  kind: PayloadProfileKind,
): DecodedTiming | DecodeFailure {
  const profile = input.connection.config.payloadProfile;
  const time = resolveEventTime(
    picked.fields.get('eventTime'),
    input.receivedAt,
    timeRulesOf({ ...profile, kind }),
  );
  if (!time.ok) return decodeFailure(time.code, time.detail, picked.rawRef);
  // availability carries no quality (contract §3.5), whatever the hosting profile declares
  const protocol =
    kind === 'availability'
      ? PROTOCOL_DEFAULT.availability
      : (profile.quality?.protocol ?? PROTOCOL_DEFAULT[kind]);
  const decoded = decodeQuality(protocol, picked.fields.get('quality'));
  return {
    common: commonFieldsOf(picked),
    at: time.at,
    observedAt: time.at.toISOString(),
    quality: toEnvelopeQuality(decoded, time),
  };
}

/** The failure of an identity or value-map step as a decode failure. */
export function failureOf(
  result: Exclude<IdentityResult | ValueMapResult, { ok: true }>,
  rawRef: DecodeRawRef,
): DecodeFailure {
  return decodeFailure(result.code, result.detail, rawRef);
}

export function isFailure(value: unknown): value is DecodeFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    value.ok === false
  );
}
