/**
 * What an MQTT sample preview decoded, as plain rows (plans/MQTT_FEEDS.md "Runtime"): for a PLA feed
 * the output and the OT report figures, for a downtime feed the start, end and attributes.
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
  pla_report: 'Read as a PLA daily report',
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

const REPORT_LABELS: ReadonlyArray<[string, string]> = [
  ['productionDate', 'Production date'],
  ['planned', 'OT planned'],
  ['shortfall', 'OT shortfall'],
  ['status', 'OT status'],
  ['quality', 'Measurement quality'],
  ['plant', 'Plant'],
  ['eventType', 'Event type'],
];

function plaFigures(result: Record<string, unknown>, values: Record<string, unknown>): PreviewFigure[] {
  const output = record(values.output);
  const rows: PreviewFigure[] = [];
  if ('quantity' in output) rows.push({ label: 'Actual (reported)', value: output.quantity });
  if ('unit' in output) rows.push({ label: 'Quantity unit', value: output.unit });
  // the preview answers what the feed read in `feedFacts` (report = OT's own figures)
  const report = record(record(result.feedFacts).report);
  for (const [key, label] of REPORT_LABELS) if (report[key] !== undefined && report[key] !== null) rows.push({ label, value: report[key] });
  return rows;
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
  if (feed.purpose === 'pla') return plaFigures(result, values);
  if (feed.purpose === 'downtime') return downtimeFigures(result, values);
  return [];
}
