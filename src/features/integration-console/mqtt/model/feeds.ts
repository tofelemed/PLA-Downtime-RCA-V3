import { defaultFields, FEED_PURPOSES, templateOf, type FeedPurpose } from './feed-templates';
import { topicFiltersOverlap, validateTopicFilter } from './topic-rules';

export { DOWNTIME_FIELD_TEMPLATE, PLA_FIELD_TEMPLATE, type FeedFieldTemplate, type FeedPurpose } from './feed-templates';
export { DOWNTIME_EXAMPLE_PAYLOAD, PLA_EXAMPLE_PAYLOAD, examplePayloadOf, examplePayloadText } from './feed-examples';

/**
 * MQTT feeds (plans/MQTT_FEEDS.md): one connection carries a PLA topic and a downtime topic, each a
 * feed with a purpose, a topic and a field mapping. The form keeps every template path (prefilled);
 * the stored profile keeps only the edited ones. Client rules mirror the server's for instant feedback.
 */
export const DURATION_UNITS = ['s', 'min', 'h'] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];
export const MAX_FEEDS = 8;
const FEED_ID = /^[a-z0-9_-]{1,32}$/;
const FIELD_PATH = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;

export interface FeedForm {
  id: string;
  purpose: FeedPurpose;
  topic: string;
  /** PLA only: the unit and product the plant-day actual is booked to */
  unitId: string;
  productId: string;
  /** downtime only */
  durationUnit: DurationUnit;
  /** template key → payload path ('' = not read) */
  fields: Record<string, string>;
}

/** A fresh feed: ids `pla`, `downtime`, then `pla-2`, …; the topic starts empty (placeholder only). */
export function newFeed(purpose: FeedPurpose, existing: readonly Pick<FeedForm, 'id'>[] = []): FeedForm {
  const taken = new Set(existing.map((feed) => feed.id));
  let id: string = purpose;
  for (let n = 2; taken.has(id); n += 1) id = `${purpose}-${n}`;
  return { id, purpose, topic: '', unitId: '', productId: '', durationUnit: 'min', fields: defaultFields(purpose) };
}

/** The same feed with another purpose: fields reset to that template, a matching id. */
export function withPurpose(feed: FeedForm, purpose: FeedPurpose, others: readonly FeedForm[]): FeedForm {
  if (feed.purpose === purpose) return feed;
  return { ...newFeed(purpose, others.filter((other) => other !== feed)), topic: feed.topic };
}

export type FeedFieldName = 'id' | 'purpose' | 'topic' | 'unitId' | 'productId' | 'durationUnit';
export type FeedProblems = Partial<Record<FeedFieldName, string>> & { fields?: Record<string, string> };
export interface FeedErrors {
  /** about the list as a whole (count) */
  list?: string;
  byFeed: Record<number, FeedProblems>;
}

export function hasFeedErrors(errors: FeedErrors): boolean {
  return Boolean(errors.list) || Object.values(errors.byFeed).some((problems) => Object.keys(problems).length > 0);
}

/** One line for the wizard step (the details sit on the feed cards). */
export function feedErrorSummary(errors: FeedErrors): string | null {
  if (errors.list) return errors.list;
  const count = Object.values(errors.byFeed).filter((problems) => Object.keys(problems).length > 0).length;
  if (count === 0) return null;
  return count === 1 ? 'A feed needs attention' : `${count} feeds need attention`;
}

function fieldProblems(feed: FeedForm): Record<string, string> {
  const problems: Record<string, string> = {};
  for (const field of templateOf(feed.purpose)) {
    const path = (feed.fields[field.key] ?? '').trim();
    if (path === '') {
      if (field.path !== '') problems[field.key] = 'Enter a field path, or reset to the template';
    } else if (!FIELD_PATH.test(path)) {
      problems[field.key] = 'Use a dotted path of letters, digits and _ (e.g. production.actual_t)';
    }
  }
  return problems;
}

function topicProblem(feeds: readonly FeedForm[], index: number): string | null {
  const topic = feeds[index].topic.trim();
  const invalid = validateTopicFilter(topic);
  if (invalid) return topic === '' ? 'Enter the topic OT publishes on' : `Topic ${invalid}`;
  for (let other = 0; other < index; other += 1) {
    const earlier = feeds[other].topic.trim();
    if (earlier === topic) return `Same topic as feed ${other + 1}`;
    if (validateTopicFilter(earlier) === null && topicFiltersOverlap(earlier, topic)) return `Overlaps the topic of feed ${other + 1}`;
  }
  return null;
}

function purposeProblems(feed: FeedForm): FeedProblems {
  const problems: FeedProblems = {};
  if (feed.purpose === 'pla') {
    if (!feed.unitId) problems.unitId = 'Choose the unit the daily actual is booked to';
    if (!feed.productId) problems.productId = 'Choose the product';
  } else if (!DURATION_UNITS.includes(feed.durationUnit)) {
    problems.durationUnit = 'Choose s, min or h';
  }
  return problems;
}

function problemsOf(feeds: readonly FeedForm[], index: number): FeedProblems {
  const feed = feeds[index];
  const problems: FeedProblems = {};
  if (!FEED_ID.test(feed.id)) problems.id = 'Feed id must match [a-z0-9_-]{1,32}';
  else if (feeds.slice(0, index).some((other) => other.id === feed.id)) problems.id = 'Feed id is used by another feed';
  if (!FEED_PURPOSES.includes(feed.purpose)) problems.purpose = 'Choose PLA or Downtime';
  const topic = topicProblem(feeds, index);
  if (topic) problems.topic = topic;
  Object.assign(problems, purposeProblems(feed));
  const fields = fieldProblems(feed);
  if (Object.keys(fields).length > 0) problems.fields = fields;
  return problems;
}

/** Every rule the server applies to `payloadProfile.feeds` (empty `byFeed` and no `list` = valid). */
export function feedErrors(feeds: readonly FeedForm[]): FeedErrors {
  const errors: FeedErrors = { byFeed: {} };
  if (feeds.length === 0) errors.list = 'Add at least one feed';
  if (feeds.length > MAX_FEEDS) errors.list = `At most ${MAX_FEEDS} feeds`;
  feeds.forEach((_feed, index) => {
    const problems = problemsOf(feeds, index);
    if (Object.keys(problems).length > 0) errors.byFeed[index] = problems;
  });
  return errors;
}

/** Only the paths that differ from the template (an empty path of a no-default key is not sent). */
export function fieldOverrides(feed: Pick<FeedForm, 'purpose' | 'fields'>): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const field of templateOf(feed.purpose)) {
    const path = (feed.fields[field.key] ?? '').trim();
    if (path !== '' && path !== field.path) overrides[field.key] = path;
  }
  return overrides;
}

export function storedFeedOf(feed: FeedForm): Record<string, unknown> {
  const base = { id: feed.id, purpose: feed.purpose, topic: feed.topic.trim() };
  const purposeKeys = feed.purpose === 'pla' ? { unitId: feed.unitId, productId: feed.productId } : { durationUnit: feed.durationUnit };
  return { ...base, ...purposeKeys, fields: fieldOverrides(feed) };
}

/** `payloadProfile` of a feeds connection, exactly the contract's shape. */
export function feedsProfileOf(feeds: readonly FeedForm[]): { kind: 'feeds'; feeds: Record<string, unknown>[] } {
  return { kind: 'feeds', feeds: feeds.map(storedFeedOf) };
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function feedFromStored(value: unknown): FeedForm {
  const stored = record(value);
  const purpose: FeedPurpose = stored.purpose === 'downtime' ? 'downtime' : 'pla';
  const fields = defaultFields(purpose);
  for (const [key, path] of Object.entries(record(stored.fields))) if (key in fields && typeof path === 'string') fields[key] = path;
  const durationUnit = DURATION_UNITS.find((unit) => unit === stored.durationUnit) ?? 'min';
  return { id: text(stored.id), purpose, topic: text(stored.topic), unitId: text(stored.unitId), productId: text(stored.productId), durationUnit, fields };
}

/** The feeds of a stored profile, template paths filled in (for editing). */
export function feedsFromProfile(profile: unknown): FeedForm[] {
  const feeds = record(profile).feeds;
  return Array.isArray(feeds) ? feeds.map(feedFromStored) : [];
}

export function isFeedsProfile(profile: unknown): boolean {
  return record(profile).kind === 'feeds';
}

/** The connection's feeds when its profile is a feeds profile, else null. */
export function feedsOfEndpoint(endpointConfig: Record<string, unknown>): FeedForm[] | null {
  return isFeedsProfile(endpointConfig.payloadProfile) ? feedsFromProfile(endpointConfig.payloadProfile) : null;
}
