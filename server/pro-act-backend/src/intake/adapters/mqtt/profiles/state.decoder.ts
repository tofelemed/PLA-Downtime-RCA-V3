import { DecodeInput, DecodeResult, ProfileDecoder } from '../decode-result';
import { pickMessage } from '../decode-stages';
import { buildEnvelope } from '../envelope-base';
import {
  messageIdFor,
  sampleSourceObjectId,
  sampleSourceRevision,
} from '../identity';
import { mapState, tokenOf } from '../value-maps';
import { decodeTiming, failureOf, isFailure } from './profile-support';

/**
 * Contract §3.3 run state → `kind = state` (design §5): `values.state` with the topic as `stateRef`,
 * the state token mapped through `valueMaps.state` (unmapped → `UNMAPPED_VALUE`, never defaulted)
 * and the previous token mapped when possible. A retained state is a stored state, not a new
 * transition (MQ02): the flag travels in `sourceControls.mqtt.retained` with the original event
 * time. The state normalizer stores digital samples for the unit state engine.
 */
const KIND = 'state_json';

export const stateDecoder: ProfileDecoder = {
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
    const rawState = picked.fields.get('state');
    const state = mapState(profile, rawState);
    if (!state.ok) return failureOf(state, picked.rawRef);
    const rawPrevious = picked.fields.get('previous');
    const previous =
      rawPrevious === undefined || rawPrevious === null
        ? null
        : previousValueOf(profile, rawPrevious);
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
        kind: 'state',
        observedAt: timing.observedAt,
        sourcePath: input.topic,
        values: {
          state: {
            stateRef: input.topic,
            value: state.value,
            previousValue: previous,
            sequence: timing.common.seq,
          },
        },
        quality: timing.quality,
        controls: { rawState: state.raw, stateMapped: state.mapped },
      }),
    };
  },
};

/** The previous state is informational: mapped when the map knows it, else the raw token. */
function previousValueOf(
  profile: Parameters<typeof mapState>[0],
  raw: unknown,
): string | null {
  const mapped = mapState(profile, raw);
  return mapped.ok ? mapped.value : tokenOf(raw);
}
