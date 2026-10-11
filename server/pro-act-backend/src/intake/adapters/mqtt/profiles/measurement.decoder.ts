import { EnvelopeValues } from '../../../envelope/canonical-envelope';
import { DecodeInput, DecodeResult, ProfileDecoder } from '../decode-result';
import { pickMessage } from '../decode-stages';
import { buildEnvelope } from '../envelope-base';
import {
  messageIdFor,
  sampleSourceObjectId,
  sampleSourceRevision,
} from '../identity';
import { digitalOf } from '../message-fields';
import { decodeTiming, failureOf, isFailure } from './profile-support';

/**
 * Contract §3.2 measurements → `kind = measurement` with `values.sample` as `MeasurementHandler`
 * expects (`signalRef` = the contract `signal`, `unit` = `uom`, `sequence` = `seq`; a digital state
 * `{ name, value }` lands in `sample.digital` with `value` null, as the PI adapter does). Delivery
 * identity `<equipment>:<boot_id>:<seq>`; logical identity topic + observation time (contract §4),
 * so a late sample is a new object and never `stale`.
 */
const KIND = 'measurement_json';

export const measurementDecoder: ProfileDecoder = {
  kind: KIND,
  decode(input: DecodeInput): DecodeResult {
    const picked = pickMessage(input, KIND);
    if (isFailure(picked)) return picked;
    const timing = decodeTiming(input, picked, KIND);
    if (isFailure(timing)) return timing;
    const profile = input.connection.config.payloadProfile;
    const identity = messageIdFor(profile.identityStrategy ?? 'seq_boot', {
      equipment: picked.equipment,
      bootId: timing.common.bootId,
      seq: timing.common.seq,
      payloadHash: picked.hash,
      eventTime: timing.observedAt,
    });
    if (!identity.ok) return failureOf(identity, picked.rawRef);
    const raw = picked.fields.get('value');
    const digital = digitalOf(raw);
    const sample: NonNullable<EnvelopeValues['sample']> = {
      signalRef: picked.fields.string('signal') ?? input.topic,
      value: digital ? null : (raw ?? null),
      unit: picked.fields.string('unit'),
      sequence: timing.common.seq,
      ...(digital ? { digital } : {}),
    };
    return {
      ok: true,
      envelope: buildEnvelope(input, picked, timing.common, {
        messageId: identity.messageId,
        sourceObjectId: sampleSourceObjectId(input.topic, timing.observedAt),
        sourceRevision: sampleSourceRevision(
          timing.common.seq,
          input.receivedAt,
        ),
        operation: 'observe',
        kind: 'measurement',
        observedAt: timing.observedAt,
        sourcePath: input.topic,
        values: { sample },
        quality: timing.quality,
        controls: { attribute: picked.captures.attribute ?? null },
      }),
    };
  },
};
