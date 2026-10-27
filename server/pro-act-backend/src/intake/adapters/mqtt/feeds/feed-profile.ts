import { topicFiltersOverlap, validateTopicFilter } from '../topic-filter';
import {
  DOWNTIME_FIELDS,
  FEED_DURATION_UNITS,
  PLA_FIELDS,
} from './feed-templates';

/**
 * Feeds of an MQTT connection (`payloadProfile.kind = 'feeds'`, owner 26 Oct 2026, plans/MQTT_FEEDS.md):
 * each topic is one feed — PLA (plant production per day) or Downtime (stops) — with its field paths
 * (template defaults, overridable once OT confirms the payload). One connection, several topics.
 */
export const FEED_PURPOSES = ['pla', 'downtime'] as const;
export type FeedPurpose = (typeof FEED_PURPOSES)[number];
export type FeedDurationUnit = (typeof FEED_DURATION_UNITS)[number];

export interface FeedSpec {
  id: string;
  purpose: FeedPurpose;
  topic: string;
  /** PLA: the unit the plant-day actual is booked to */
  unitId?: string;
  /** PLA: the product of the booked line */
  productId?: string;
  /** Downtime: unit of the duration field (default minutes) */
  durationUnit?: FeedDurationUnit;
  /** overrides of the template paths (field key → dotted JSON path) */
  fields?: Record<string, string>;
}

export const MAX_FEEDS = 8;
const FEED_ID = /^[a-z0-9_-]{1,32}$/;
const FIELD_PATH = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEED_KEYS = new Set([
  'id',
  'purpose',
  'topic',
  'unitId',
  'productId',
  'durationUnit',
  'fields',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Problems of `payloadProfile.feeds` (`<path>: <message>`; empty = valid). */
export function validateFeeds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ['payloadProfile.feeds: at least one feed is required'];
  }
  const problems: string[] = [];
  if (value.length > MAX_FEEDS)
    problems.push(`payloadProfile.feeds: at most ${MAX_FEEDS} feeds`);
  value.forEach((feed: unknown, index) =>
    problems.push(...feedProblems(feed, `payloadProfile.feeds[${index}]`)),
  );
  problems.push(...clashes(value.filter(isRecord)));
  return problems;
}

function feedProblems(feed: unknown, path: string): string[] {
  if (!isRecord(feed)) return [`${path}: must be an object`];
  const problems = Object.keys(feed)
    .filter((key) => !FEED_KEYS.has(key))
    .map((key) => `${path}.${key}: unknown setting`);
  if (typeof feed.id !== 'string' || !FEED_ID.test(feed.id))
    problems.push(`${path}.id: 1–32 of a-z, 0-9, _ or -`);
  const purpose = (FEED_PURPOSES as readonly unknown[]).includes(feed.purpose)
    ? (feed.purpose as FeedPurpose)
    : null;
  if (!purpose) problems.push(`${path}.purpose: must be pla or downtime`);
  const topicProblem = validateTopicFilter(feed.topic);
  if (topicProblem) problems.push(`${path}.topic: ${topicProblem}`);
  if (purpose === 'pla') problems.push(...plaProblems(feed, path));
  if (purpose !== 'downtime' && feed.durationUnit !== undefined)
    problems.push(`${path}.durationUnit: downtime feeds only`);
  if (
    purpose === 'downtime' &&
    feed.durationUnit !== undefined &&
    !(FEED_DURATION_UNITS as readonly unknown[]).includes(feed.durationUnit)
  ) {
    problems.push(
      `${path}.durationUnit: must be one of ${FEED_DURATION_UNITS.join(', ')}`,
    );
  }
  if (purpose)
    problems.push(...fieldProblems(feed.fields, purpose, `${path}.fields`));
  return problems;
}

function plaProblems(feed: Record<string, unknown>, path: string): string[] {
  const problems: string[] = [];
  if (typeof feed.unitId !== 'string' || !UUID.test(feed.unitId))
    problems.push(
      `${path}.unitId: choose the unit the daily actual is booked to`,
    );
  if (typeof feed.productId !== 'string' || !UUID.test(feed.productId))
    problems.push(`${path}.productId: choose the product`);
  return problems;
}

function fieldProblems(
  fields: unknown,
  purpose: FeedPurpose,
  path: string,
): string[] {
  if (fields === undefined) return [];
  if (!isRecord(fields)) return [`${path}: must be an object of field paths`];
  const known = purpose === 'pla' ? PLA_FIELDS : DOWNTIME_FIELDS;
  return Object.entries(fields).flatMap(([key, entry]) => {
    if (!(key in known)) return [`${path}.${key}: not a ${purpose} field`];
    return typeof entry === 'string' && FIELD_PATH.test(entry)
      ? []
      : [`${path}.${key}: must be a dotted JSON path`];
  });
}

/** Feed ids and topics are unique, and two feeds never listen on overlapping topics. */
function clashes(feeds: Record<string, unknown>[]): string[] {
  const problems: string[] = [];
  feeds.forEach((feed, index) => {
    feeds.slice(0, index).forEach((earlier) => {
      if (feed.id === earlier.id)
        problems.push(
          `payloadProfile.feeds[${index}].id: duplicate of an earlier feed`,
        );
      if (
        typeof feed.topic === 'string' &&
        typeof earlier.topic === 'string' &&
        topicFiltersOverlap(feed.topic, earlier.topic)
      ) {
        problems.push(
          `payloadProfile.feeds[${index}].topic: overlaps the topic of feed ${String(earlier.id)}`,
        );
      }
    });
  });
  return problems;
}

/** The topic filters the connection subscribes to for its feeds. */
export function feedTopics(feeds: readonly FeedSpec[] | undefined): string[] {
  return [...new Set((feeds ?? []).map((feed) => feed.topic))];
}
