import { DecodeInput, DecodeResult, ProfileDecoder } from '../decode-result';
import { PayloadProfileKind } from '../payload-profile';
import { topicMatchesFilter } from '../topic-filter';
import { availabilityDecoder } from './availability.decoder';
import { intervalEventDecoder } from './interval-event.decoder';
import { measurementDecoder } from './measurement.decoder';
import { feedsDecoder } from './feeds.decoder';
import { stateDecoder } from './state.decoder';

/**
 * Profile registry (design §3 "profile_type + ProfileRegistry"): decoders are code, keyed by
 * `payloadProfile.kind`; per-connection behaviour is the profile block. A new payload shape is a new
 * decoder here, never a transport change.
 */
export const PROFILE_DECODERS: Record<PayloadProfileKind, ProfileDecoder> = {
  interval_event_json: intervalEventDecoder,
  measurement_json: measurementDecoder,
  state_json: stateDecoder,
  availability: availabilityDecoder,
  feeds: feedsDecoder,
};

export function decoderFor(kind: PayloadProfileKind): ProfileDecoder {
  return PROFILE_DECODERS[kind];
}

/**
 * Decodes one packet of a connection: a message on the configured `availabilityTopic` goes to the
 * availability decoder whatever the profile kind; everything else to the profile's decoder.
 */
export function decodeMqttMessage(input: DecodeInput): DecodeResult {
  const { mqtt, payloadProfile } = input.connection.config;
  const onAvailabilityTopic =
    mqtt.availabilityTopic !== undefined &&
    topicMatchesFilter(input.topic, mqtt.availabilityTopic);
  const kind = onAvailabilityTopic ? 'availability' : payloadProfile.kind;
  return decoderFor(kind).decode(input);
}
