/**
 * Template field paths of the MQTT feeds (plans/MQTT_FEEDS.md): the owner's sample PLA payload and the
 * proposed downtime payload, until OT confirms them. A feed overrides any path in `fields`.
 */
export interface FeedField {
  path: string;
  required: boolean;
}

export const FEED_DURATION_UNITS = ['s', 'min', 'h'] as const;

export const PLA_FIELDS = {
  eventId: { path: 'event_id', required: true },
  revision: { path: 'event_revision', required: false },
  productionDate: { path: 'production_date', required: true },
  periodStart: { path: 'period_start', required: true },
  periodEnd: { path: 'period_end', required: true },
  actual: { path: 'production.actual_good_production_t', required: true },
  planned: { path: 'plan.planned_production_t', required: false },
  shortfall: { path: 'production.shortfall_t', required: true },
  status: { path: 'status', required: false },
  quality: { path: 'production.measurement_quality', required: false },
  plant: { path: 'plant', required: false },
  eventType: { path: 'event_type', required: false },
  uom: { path: 'uom', required: false },
  planSource: { path: 'plan.source', required: false },
  planId: { path: 'plan.plan_id', required: false },
  planRevision: { path: 'plan.revision', required: false },
  planApproved: { path: 'plan.approved', required: false },
  piActualTag: { path: 'pi_source.actual_tag', required: false },
  piEventFrameId: { path: 'pi_source.event_frame_id', required: false },
} satisfies Record<string, FeedField>;

export const DOWNTIME_FIELDS = {
  eventId: { path: 'event_id', required: true },
  revision: { path: 'event_revision', required: false },
  unit: { path: 'unit', required: false },
  equipment: { path: 'equipment', required: false },
  start: { path: 'start_time', required: true },
  end: { path: 'end_time', required: false },
  duration: { path: 'duration_min', required: false },
  reason: { path: 'reason_code', required: false },
  description: { path: 'description', required: false },
  status: { path: 'status', required: false },
  plant: { path: 'plant', required: false },
  eventType: { path: 'event_type', required: false },
} satisfies Record<string, FeedField>;

export type PlaFieldKey = keyof typeof PLA_FIELDS;
export type DowntimeFieldKey = keyof typeof DOWNTIME_FIELDS;

/** Seconds per duration unit of a downtime feed. */
export const DURATION_SECONDS: Readonly<
  Record<(typeof FEED_DURATION_UNITS)[number], number>
> = {
  s: 1,
  min: 60,
  h: 3600,
};
