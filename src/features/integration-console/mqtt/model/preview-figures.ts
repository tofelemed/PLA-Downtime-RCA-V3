/**
 * What an MQTT sample preview decoded, as plain rows (plans/MQTT_FEEDS.md "Runtime"): for a PLA feed
 * the declared production loss figures, for a downtime feed the start, end and attributes.
 */
export interface PreviewFeed {
  id: string;
  purpose: string;
}

export interface PreviewFigure {
  label: string;
  value: unknown;
  /** an instant (shown on the plant clock) */
  time?: boolean;
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const BINDING_STATUS_LABELS: Readonly<Record<string, string>> = {
  production_loss_event: 'Read as a production loss event',
  downtime_event: 'Read as a downtime stop',
};

export function bindingStatusLabel(status: string | undefined): string {
  if (!status) return '';
  return BINDING_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

/** A topic OT could publish on for a feed filter (`+` / `#` levels become `sample`). */
export function sampleTopicOf(filter: string): string {
  return filter
    .trim()
    .split('/')
    .map((level) => (level === '+' || level === '#' ? 'sample' : level))
    .join('/');
}

const DECLARED_LABELS: ReadonlyArray<[string, string]> = [
  ['planned', 'OT planned'],
  ['actual', 'OT actual'],
  ['shortfall', 'OT shortfall'],
  ['uom', 'Quantity unit'],
  ['status', 'OT status'],
  ['identityGap', 'Identity gap (planned − actual − shortfall)'],
];

/** The declared figures the preview read (`feedFacts.declared`), or null when the message has none. */
function declaredOf(result: Record<string, unknown>): Record<string, unknown> | null {
  const declared = record(result.feedFacts).declared;
  return typeof declared === 'object' && declared !== null && !Array.isArray(declared) ? (declared as Record<string, unknown>) : null;
}

function plaFigures(result: Record<string, unknown>): PreviewFigure[] {
  const declared = declaredOf(result);
  if (!declared) return [];
  return DECLARED_LABELS.flatMap(([key, label]) => (declared[key] !== undefined && declared[key] !== null ? [{ label, value: declared[key] }] : []));
}

/**
 * A PLA message the preview binds to a production loss event but from which no declared figures could be
 * read: the live feed would quarantine it, so the preview says so.
 */
export function previewWarning(response: unknown): string | null {
  const result = record(response);
  if (result.bindingStatus !== 'production_loss_event' || declaredOf(result) !== null) return null;
  return 'The declared figures could not be read from this message (check the field paths and that the shortfall is a number). The message will be quarantined.';
}

const ATTRIBUTE_LABELS: Readonly<Record<string, string>> = {
  ReasonCode: 'Reason',
  Description: 'Description',
  Quantity: 'Lost production',
  Duration: 'Duration',
};

function downtimeFigures(result: Record<string, unknown>, values: Record<string, unknown>): PreviewFigure[] {
  const rows: PreviewFigure[] = [];
  const start = result.startTime ?? values.startTime;
  const end = 'endTime' in result ? result.endTime : values.endTime;
  if (start !== undefined) rows.push({ label: 'Start', value: start, time: true });
  if (end !== undefined) rows.push({ label: 'End', value: end ?? 'ongoing', time: end !== null });
  const facts = record(result.feedFacts);
  if (typeof facts.unit === 'string') rows.push({ label: 'Unit code', value: facts.unit });
  if (typeof facts.equipment === 'string') rows.push({ label: 'Equipment code', value: facts.equipment });
  const attributes = Array.isArray(values.attributes) ? values.attributes.map(record) : [];
  for (const attribute of attributes) {
    if (typeof attribute.name !== 'string' || attribute.name === 'Equipment') continue;
    const unit = typeof attribute.unit === 'string' ? ` ${attribute.unit}` : '';
    rows.push({ label: ATTRIBUTE_LABELS[attribute.name] ?? attribute.name, value: `${String(attribute.value)}${unit}` });
  }
  return rows;
}

/** The decoded feed values of a preview response (empty when it was not a feed message). */
export function previewFigures(response: unknown): PreviewFigure[] {
  const result = record(response);
  const feed = record(result.feed);
  const values = record(result.values);
  if (feed.purpose === 'pla') return plaFigures(result);
  if (feed.purpose === 'downtime') return downtimeFigures(result, values);
  return [];
}
