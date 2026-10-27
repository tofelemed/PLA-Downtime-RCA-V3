import { describe, expect, it } from 'vitest';
import { feedErrorsFromFieldErrors } from './feed-server-errors';
import {
  DOWNTIME_FIELD_TEMPLATE,
  examplePayloadOf,
  feedErrors,
  feedsFromProfile,
  feedsProfileOf,
  newFeed,
  PLA_EXAMPLE_PAYLOAD,
  PLA_FIELD_TEMPLATE,
  storedFeedOf,
  withPurpose,
  type FeedForm,
} from './feeds';
import { emptyMqttForm, mqttCreateBody } from './mqtt-form';
import { formFieldOf } from './mqtt-steps';
import { mqttFormErrors } from './mqtt-validation';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { endpointSummary } from '../../model/endpoint-summary';
import { bindingStatusLabel, previewFigures, previewWarning, sampleTopicOf } from './preview-figures';

const pla = (patch: Partial<FeedForm> = {}): FeedForm => ({ ...newFeed('pla'), topic: 'marun/hdpe/pla', unitId: 'u1', productId: 'p1', ...patch });
const downtime = (patch: Partial<FeedForm> = {}): FeedForm => ({ ...newFeed('downtime'), topic: 'marun/hdpe/downtime', ...patch });

describe('feed templates (plans/MQTT_FEEDS.md)', () => {
  it('carries the contract default paths and required keys', () => {
    const paths = Object.fromEntries(PLA_FIELD_TEMPLATE.map((field) => [field.key, field.path]));
    expect(paths).toEqual({
      eventId: 'event_id', revision: 'event_revision', productionDate: 'production_date', periodStart: 'period_start', periodEnd: 'period_end',
      actual: 'production.actual_good_production_t', planned: 'plan.planned_production_t', shortfall: 'production.shortfall_t', status: 'status',
      quality: 'production.measurement_quality', plant: 'plant', eventType: 'event_type', uom: 'uom',
      planSource: 'plan.source', planId: 'plan.plan_id', planRevision: 'plan.revision', planApproved: 'plan.approved',
      piActualTag: 'pi_source.actual_tag', piEventFrameId: 'pi_source.event_frame_id',
    });
    expect(PLA_FIELD_TEMPLATE.filter((field) => field.required).map((field) => field.key)).toEqual(['eventId', 'productionDate', 'periodStart', 'periodEnd', 'actual', 'shortfall']);
    expect(DOWNTIME_FIELD_TEMPLATE.map((field) => field.key)).not.toContain('lostQuantity');
    expect(PLA_FIELD_TEMPLATE.find((field) => field.key === 'shortfall')?.help).toContain('production loss event');
    expect(DOWNTIME_FIELD_TEMPLATE.filter((field) => field.required).map((field) => field.key)).toEqual(['eventId', 'start']);
    expect(DOWNTIME_FIELD_TEMPLATE.find((field) => field.key === 'duration')?.path).toBe('duration_min');
  });

  it('new feeds: ids pla, downtime, then pla-2; empty topics; downtime in minutes', () => {
    const first = newFeed('pla');
    expect(first).toMatchObject({ id: 'pla', topic: '', unitId: '', productId: '', durationUnit: 'min' });
    expect(newFeed('downtime', [first]).id).toBe('downtime');
    expect(newFeed('pla', [first, newFeed('downtime')]).id).toBe('pla-2');
    expect(newFeed('pla', [first, { id: 'pla-2' }]).id).toBe('pla-3');
  });

  it('changing the purpose resets the fields to the other template and keeps the topic', () => {
    const feed = pla({ fields: { ...pla().fields, actual: 'x.actual' } });
    const changed = withPurpose(feed, 'downtime', [feed]);
    expect(changed).toMatchObject({ purpose: 'downtime', id: 'downtime', topic: 'marun/hdpe/pla' });
    expect(changed.fields.start).toBe('start_time');
    expect(changed.fields).not.toHaveProperty('actual');
  });
});

describe('feed rules mirror the server', () => {
  it('accepts a PLA and a downtime feed', () => {
    expect(feedErrors([pla(), downtime()])).toEqual({ byFeed: {} });
  });

  it('refuses no feeds, more than eight, duplicate or overlapping topics, missing booking and bad paths', () => {
    expect(feedErrors([]).list).toBe('Add at least one feed');
    expect(feedErrors(Array.from({ length: 9 }, (_, index) => downtime({ id: `d${index}`, topic: `t/${index}` }))).list).toBe('At most 8 feeds');
    const errors = feedErrors([
      pla({ unitId: '', productId: '' }),
      downtime({ topic: 'marun/hdpe/pla' }),
      downtime({ id: 'pla', topic: 'marun/#', fields: { ...downtime().fields, start: 'bad path', eventId: '' } }),
      downtime({ id: 'x', topic: 'a/#/b', durationUnit: 'd' as FeedForm['durationUnit'] }),
    ]);
    expect(errors.byFeed[0]).toEqual({ unitId: expect.any(String) });
    expect(storedFeedOf(pla({ productId: '' }))).not.toHaveProperty('productId');
    expect(errors.byFeed[1].topic).toBe('Same topic as feed 1');
    expect(errors.byFeed[2]).toMatchObject({ id: 'Feed id is used by another feed', topic: 'Overlaps the topic of feed 1' });
    expect(Object.keys(errors.byFeed[2].fields ?? {})).toEqual(['eventId', 'start']);
    expect(errors.byFeed[3]).toMatchObject({ topic: 'Topic # is only allowed as the last level', durationUnit: 'Choose s, min or h' });
    expect(feedErrors([pla({ topic: '' })]).byFeed[0].topic).toBe('Enter the topic OT publishes on');
    expect(feedErrors([pla({ id: 'Bad Id' })]).byFeed[0].id).toMatch(/\[a-z0-9_-\]/);
  });
});

describe('feeds profile', () => {
  it('sends only the edited paths and the purpose keys, and round-trips for editing', () => {
    const edited = pla({ fields: { ...pla().fields, actual: 'production.good_t', uom: 'production.uom' } });
    const profile = feedsProfileOf([edited, downtime({ durationUnit: 's' })]);
    expect(profile).toEqual({
      kind: 'feeds',
      feeds: [
        { id: 'pla', purpose: 'pla', topic: 'marun/hdpe/pla', unitId: 'u1', productId: 'p1', fields: { actual: 'production.good_t', uom: 'production.uom' } },
        { id: 'downtime', purpose: 'downtime', topic: 'marun/hdpe/downtime', durationUnit: 's', fields: {} },
      ],
    });
    const back = feedsFromProfile(profile);
    expect(back[0].fields.actual).toBe('production.good_t');
    expect(back[0].fields.eventId).toBe('event_id');
    expect(feedsProfileOf(back)).toEqual(profile);
    expect(feedsFromProfile({ kind: 'feeds', feeds: [{ id: 'd', purpose: 'downtime', topic: 't', fields: { nope: 'x' } }] })[0]).toMatchObject({ durationUnit: 'min', fields: { start: 'start_time' } });
  });

  it('the example follows edited paths', () => {
    expect(examplePayloadOf('pla')).toEqual(PLA_EXAMPLE_PAYLOAD);
    const moved = examplePayloadOf('pla', { actual: 'output.good_t' });
    expect(moved.output).toEqual({ good_t: 208 });
    expect((moved.production as Record<string, unknown>).actual_good_production_t).toBeUndefined();
    expect(examplePayloadOf('downtime').duration_min).toBe(35);
  });

  it('wizard default: feeds mode, no topic filters, the feeds profile, and feed rules instead of topic rules', () => {
    const form = { ...emptyMqttForm(), displayName: 'Marun', brokerUrl: 'mqtt://b:1883', feeds: [pla(), downtime()] };
    expect(mqttFormErrors(form)).toEqual({});
    const config = mqttCreateBody(form).endpointConfig as { mqtt: { topics: unknown }; payloadProfile: unknown };
    expect(config.mqtt.topics).toEqual([]);
    expect(config.payloadProfile).toEqual(feedsProfileOf([pla(), downtime()]));
    expect(mqttFormErrors(emptyMqttForm()).feeds).toBe('2 feeds need attention');
    expect(mqttFormErrors(emptyMqttForm())).not.toHaveProperty('topics');
  });

  it('maps server field errors onto feeds', () => {
    expect(formFieldOf('endpointConfig.payloadProfile.feeds[1].topic')).toBe('feeds');
    const errors = feedErrorsFromFieldErrors([
      { field: 'endpointConfig.payloadProfile.feeds[1].topic', message: 'overlaps feed 0' },
      { field: 'endpointConfig.payloadProfile.feeds.0.fields.actual', message: 'bad path' },
      { field: 'endpointConfig.payloadProfile.feeds', message: 'at most 8' },
      { field: 'endpointConfig.mqtt.qos', message: 'ignored' },
    ]);
    expect(errors).toEqual({ list: 'at most 8', byFeed: { 0: { fields: { actual: 'bad path' } }, 1: { topic: 'overlaps feed 0' } } });
  });
});

describe('sample preview of a feed message', () => {
  it('labels the feed binding statuses, builds a publishable topic and lists the decoded figures', () => {
    expect(bindingStatusLabel('production_loss_event')).toBe('Read as a production loss event');
    expect(bindingStatusLabel('downtime_event')).toBe('Read as a downtime stop');
    expect(bindingStatusLabel('unknown_signal')).toBe('unknown signal');
    expect(sampleTopicOf('marun/+/pla/#')).toBe('marun/sample/pla/sample');
    const plaRows = previewFigures({ feed: { id: 'pla', purpose: 'pla' }, bindingStatus: 'production_loss_event', feedFacts: { declared: { planned: 240, actual: 208, shortfall: 32, uom: 't', status: 'DETECTED', identityGap: 0 } } });
    expect(plaRows.map((row) => [row.label, row.value])).toEqual([['OT planned', 240], ['OT actual', 208], ['OT shortfall', 32], ['Quantity unit', 't'], ['OT status', 'DETECTED'], ['Identity gap (planned − actual − shortfall)', 0]]);
    expect(previewWarning({ feed: { id: 'pla', purpose: 'pla' }, bindingStatus: 'production_loss_event', feedFacts: { declared: null } })).toContain('will be quarantined');
    expect(previewWarning({ feed: { id: 'pla', purpose: 'pla' }, bindingStatus: 'production_loss_event', feedFacts: { declared: { shortfall: 1 } } })).toBeNull();
    expect(previewWarning({ feed: { id: 'downtime', purpose: 'downtime' }, bindingStatus: 'downtime_event' })).toBeNull();
    const stopRows = previewFigures({ feed: { id: 'downtime', purpose: 'downtime' }, startTime: '2026-10-25T02:42:00Z', endTime: null, feedFacts: { unit: 'Extruder1', equipment: 'EXT1-Main' }, values: { attributes: [{ name: 'ReasonCode', type: 'string', value: 'MECH-GEARBOX' }, { name: 'Duration', type: 'number', value: 2100, unit: 's' }, { name: 'Equipment', type: 'string', value: 'EXT1-Main' }] } });
    expect(stopRows.map((row) => [row.label, row.value])).toEqual([['Start', '2026-10-25T02:42:00Z'], ['End', 'ongoing'], ['Unit code', 'Extruder1'], ['Equipment code', 'EXT1-Main'], ['Reason', 'MECH-GEARBOX'], ['Duration', '2100 s']]);
    expect(previewFigures({ feed: null, values: {} })).toEqual([]);
  });
});

describe('feeds connection header', () => {
  it('names the feeds instead of the (empty) topic filters', () => {
    const connection = {
      id: 'c1', sourceType: 'mqtt', displayName: 'OT', hasSecret: true, effectiveClientId: null, capabilities: {}, configVersion: 1, isActive: true, rowVersion: 1,
      createdAt: '2026-10-26T00:00:00Z', updatedAt: null,
      endpointConfig: { mqtt: { brokerUrl: 'mqtt://mqtt:1885', protocolVersion: 5, topics: [] }, payloadProfile: { kind: 'feeds', feeds: [{ purpose: 'pla' }, { purpose: 'downtime' }] } },
    } as unknown as ConnectionView;
    expect(endpointSummary(connection)).toBe('mqtt://mqtt:1885 · MQTT 5 · 2 feeds (PLA, downtime)');
  });
});

