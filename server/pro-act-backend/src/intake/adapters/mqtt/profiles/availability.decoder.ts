import { DecodeInput, DecodeResult, ProfileDecoder } from '../decode-result';
import { pickMessage } from '../decode-stages';
import { buildEnvelope } from '../envelope-base';
import { messageIdFor, sampleSourceRevision } from '../identity';
import { decodeTiming, failureOf, isFailure } from './profile-support';

/**
 * Contract §3.5 gateway availability → `kind = state` with `stateRef` = the topic, value ONLINE |
 * OFFLINE and `sourceControls.mqtt.availability = true` (design §4.5: the step-3/5 handler turns it
 * into `SourceHealthChanged`, never into a stop, T11). A Last Will is registered before any sequence
 * exists, so `seq` is optional here: without it the delivery identity falls back to the payload hash
 * plus event time.
 */
const KIND = 'availability';

export const availabilityDecoder: ProfileDecoder = {
  kind: KIND,
  decode(input: DecodeInput): DecodeResult {
    const picked = pickMessage(input, KIND);
    if (isFailure(picked)) return picked;
    const timing = decodeTiming(input, picked, KIND);
    if (isFailure(timing)) return timing;
    // the profile's strategy may be event_id (an events connection): availability has no event id
    const profile = input.connection.config.payloadProfile;
    const strategy =
      profile.identityStrategy === 'payload_hash' || timing.common.seq === null
        ? 'payload_hash'
        : 'seq_boot';
    const identity = messageIdFor(strategy, {
      equipment: picked.equipment,
      bootId: timing.common.bootId,
      seq: timing.common.seq,
      payloadHash: picked.hash,
      eventTime: timing.observedAt,
    });
    if (!identity.ok) return failureOf(identity, picked.rawRef);
    const piConnected = picked.fields.get('piConnected');
    return {
      ok: true,
      envelope: buildEnvelope(input, picked, timing.common, {
        messageId: identity.messageId,
        sourceObjectId: input.topic,
        sourceRevision: sampleSourceRevision(
          timing.common.seq,
          input.receivedAt,
        ),
        operation: 'observe',
        kind: 'state',
        observedAt: timing.observedAt,
        sourcePath: input.topic,
        values: {
          state: {
            stateRef: input.topic,
            value: picked.fields.string('state') ?? 'OFFLINE',
            sequence: timing.common.seq,
          },
        },
        quality: timing.quality,
        controls: {
          availability: true,
          piConnected: typeof piConnected === 'boolean' ? piConnected : null,
        },
      }),
    };
  },
};
