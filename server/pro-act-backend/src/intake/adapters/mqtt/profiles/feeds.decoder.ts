import {
  CanonicalEnvelope,
  EnvelopeAttribute,
} from '../../../envelope/canonical-envelope';
import {
  decodeFailure,
  DecodeInput,
  DecodeResult,
  ProfileDecoder,
} from '../decode-result';
import { parsePacket, ParsedPacket } from '../decode-stages';
import { buildEnvelope, EnvelopeParts } from '../envelope-base';
import { FeedSpec } from '../feeds/feed-profile';
import { FeedReader } from '../feeds/feed-reader';
import { DURATION_SECONDS } from '../feeds/feed-templates';
import { topicMatchesFilter } from '../topic-filter';

const NO_DELIVERY = { bootId: null, seq: null, source: null };
const GOOD = { status: 'good' as const };

/**
 * Feeds profile (plans/MQTT_FEEDS.md): the topic picks the feed, the feed's field paths read the message.
 * PLA → an `output_event` (one plant production day, booked to the feed's unit and product); Downtime →
 * an `interval_event` (a stop, open while it has no end). Missing or malformed fields are SCHEMA_INVALID
 * naming the field and path; no contract schema applies (OT's payload is not final yet).
 */
export const feedsDecoder: ProfileDecoder = {
  kind: 'feeds',
  decode(input: DecodeInput): DecodeResult {
    const packet = parsePacket(input);
    if ('ok' in packet) return packet;
    const feed = (input.connection.config.payloadProfile.feeds ?? []).find(
      (candidate) => topicMatchesFilter(input.topic, candidate.topic),
    );
    if (!feed)
      return decodeFailure(
        'TOPIC_SHAPE',
        `topic ${input.topic} belongs to no feed`,
        packet.rawRef,
      );
    const reader = new FeedReader(feed, packet.json);
    const parts =
      feed.purpose === 'pla'
        ? plaParts(feed, reader, input)
        : downtimeParts(feed, reader, input);
    if (!parts || reader.problems.length > 0) {
      return decodeFailure(
        'SCHEMA_INVALID',
        `${feed.purpose} feed "${feed.id}": ${reader.problems.join('; ')}`,
        packet.rawRef,
      );
    }
    return { ok: true, envelope: envelopeOf(input, packet, parts) };
  },
};

function envelopeOf(
  input: DecodeInput,
  packet: ParsedPacket,
  parts: EnvelopeParts & { unitId?: string },
): CanonicalEnvelope {
  const envelope = buildEnvelope(input, packet, NO_DELIVERY, parts);
  return parts.unitId
    ? { ...envelope, location: { ...envelope.location, unitId: parts.unitId } }
    : envelope;
}

/**
 * One plant production day, declared by OT: an `interval_event` over the period whose attributes carry
 * the planned / actual / shortfall figures and their provenance (the PLA handler turns it into one
 * `production_loss` event on the feed's unit). Overproduction (a negative shortfall) is the handler's call.
 */
function plaParts(
  feed: FeedSpec,
  reader: FeedReader,
  input: DecodeInput,
): (EnvelopeParts & { unitId?: string }) | null {
  const eventId = reader.string('eventId');
  const revision = reader.string('revision') ?? '1';
  reader.date('productionDate');
  const start = reader.time('periodStart');
  const end = reader.time('periodEnd');
  const actual = reader.number('actual');
  const shortfall = reader.number('shortfall');
  const attributes = plaAttributes(reader, { actual, shortfall });
  if (start && end && start >= end)
    reader.problems.push('periodStart must be before periodEnd');
  if (!eventId || !start || !end || actual === null || shortfall === null)
    return null;
  return {
    messageId: `pla:${eventId}:${revision}`,
    sourceObjectId: `pla:${eventId}`,
    sourceRevision: revision,
    operation: 'observe',
    kind: 'interval_event',
    observedAt: end.toISOString(),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    sourcePath: reader.string('plant') ?? input.topic,
    unitId: feed.unitId,
    values: { templateName: 'Production Loss Declared', attributes },
    quality: GOOD,
    controls: { feed: 'pla', feedId: feed.id, eventId },
  };
}

function plaAttributes(
  reader: FeedReader,
  figures: { actual: number | null; shortfall: number | null },
): EnvelopeAttribute[] {
  const uom = reader.string('uom') ?? 't';
  const attributes: EnvelopeAttribute[] = [];
  const tonnes = (name: string, value: number | null) => {
    if (value !== null)
      attributes.push({ name, type: 'number', value, unit: uom });
  };
  const text = (name: string, value: string | null) => {
    if (value !== null) attributes.push({ name, type: 'string', value });
  };
  tonnes('Planned', reader.number('planned'));
  tonnes('Actual', figures.actual);
  tonnes('Shortfall', figures.shortfall);
  text('MeasurementQuality', reader.string('quality'));
  text('Status', reader.string('status') ?? 'REPORTED');
  text('PlanSource', reader.string('planSource'));
  text('PlanId', reader.string('planId'));
  const planRevision = reader.number('planRevision');
  if (planRevision !== null)
    attributes.push({
      name: 'PlanRevision',
      type: 'number',
      value: planRevision,
    });
  const approved = reader.boolean('planApproved');
  if (approved !== null)
    attributes.push({ name: 'PlanApproved', type: 'boolean', value: approved });
  text('PiActualTag', reader.string('piActualTag'));
  text('PiEventFrameId', reader.string('piEventFrameId'));
  return attributes;
}

/** One stop: open while it has no end (a later message with the same event id closes it). */
function downtimeParts(
  feed: FeedSpec,
  reader: FeedReader,
  input: DecodeInput,
): EnvelopeParts | null {
  const eventId = reader.string('eventId');
  const revision = reader.string('revision');
  const unit = reader.string('unit');
  const equipment = reader.string('equipment');
  const start = reader.time('start');
  const duration = reader.number('duration');
  const durationSeconds =
    duration === null
      ? null
      : duration * DURATION_SECONDS[feed.durationUnit ?? 'min'];
  const end =
    reader.time('end') ??
    (start && durationSeconds !== null && durationSeconds > 0
      ? new Date(start.getTime() + durationSeconds * 1000)
      : null);
  if (!unit && !equipment)
    reader.problems.push(
      `unit (${reader.pathOf('unit')}) or equipment (${reader.pathOf('equipment')}) is required`,
    );
  if (start && end && start >= end)
    reader.problems.push('the stop must end after it starts');
  const attributes = downtimeAttributes(reader, durationSeconds, equipment);
  if (!eventId || !start || (!unit && !equipment)) return null;
  return {
    messageId: `downtime:${eventId}:${revision ?? (end ? `closed:${end.toISOString()}` : 'open')}`,
    sourceObjectId: `downtime:${eventId}`,
    sourceRevision: revision,
    operation: 'observe',
    kind: 'interval_event',
    observedAt: (end ?? start).toISOString(),
    startTime: start.toISOString(),
    endTime: end ? end.toISOString() : null,
    sourcePath: unit ?? equipment ?? input.topic,
    values: { templateName: 'Production Loss', attributes },
    quality: GOOD,
    controls: {
      feed: 'downtime',
      feedId: feed.id,
      eventId,
      unit,
      equipment,
      status: reader.string('status'),
      plant: reader.string('plant'),
    },
  };
}

/** The stop's facts as Production Loss attributes the typed mapping reads (reason, text, tonnes, duration). */
function downtimeAttributes(
  reader: FeedReader,
  durationSeconds: number | null,
  equipment: string | null,
): EnvelopeAttribute[] {
  const attributes: EnvelopeAttribute[] = [];
  const reason = reader.string('reason');
  const description = reader.string('description');
  if (reason)
    attributes.push({ name: 'ReasonCode', type: 'string', value: reason });
  if (description)
    attributes.push({
      name: 'Description',
      type: 'string',
      value: description,
    });
  if (durationSeconds !== null)
    attributes.push({
      name: 'Duration',
      type: 'number',
      value: durationSeconds,
      unit: 's',
    });
  if (equipment)
    attributes.push({ name: 'Equipment', type: 'string', value: equipment });
  return attributes;
}
