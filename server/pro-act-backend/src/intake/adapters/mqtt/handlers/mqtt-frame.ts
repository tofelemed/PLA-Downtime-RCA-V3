import type { PiEventFrame } from '../../../../integration/pi-frame-ingest.service';
import {
  CanonicalEnvelope,
  EnvelopeAttribute,
} from '../../../envelope/canonical-envelope';

/** An MQTT interval event in the shape the PI frame ingest path consumes. */
export interface MqttFrame {
  frame: PiEventFrame;
  attributes: Record<string, unknown>;
}

/**
 * Contract §3.1 event → `PiEventFrame` + attributes (integration plan WP2 table): `event_id` is the
 * frame id (`production_events.event_id`), `revision` its source revision, `template` the template
 * name, `element_path` the primary element path the source mappings resolve, `start_ts` / `end_ts`
 * the half-open interval. Digital attributes keep PI's `{ Name, Value, IsSystem }` form so the typed
 * attribute mapping reads them exactly as PI delivers them.
 */
export function mqttFrameOf(envelope: CanonicalEnvelope): MqttFrame {
  if (envelope.kind !== 'interval_event' || !envelope.startTime) {
    throw new Error(`envelope ${envelope.messageId} is not an interval event`);
  }
  const controls = envelope.sourceControls?.mqtt ?? {};
  const eventId =
    typeof controls.eventId === 'string' && controls.eventId.length > 0
      ? controls.eventId
      : envelope.sourceObjectId;
  return {
    frame: {
      WebId: eventId,
      Name: null,
      TemplateName: envelope.values?.templateName ?? null,
      StartTime: envelope.startTime,
      EndTime: envelope.endTime ?? null,
      Path: envelope.location.sourcePath,
      PrimaryReferencedElement: {
        WebId: null,
        Path: envelope.location.sourcePath,
      },
      SourceRevision: envelope.sourceRevision ?? null,
    },
    attributes: attributesOf(envelope.values?.attributes ?? []),
  };
}

function attributesOf(
  attributes: readonly EnvelopeAttribute[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const attribute of attributes) {
    result[attribute.name] = attribute.digital
      ? {
          Name: attribute.digital.name,
          Value: attribute.digital.value,
          IsSystem: attribute.digital.isSystem ?? false,
        }
      : (attribute.value ?? null);
  }
  return result;
}
