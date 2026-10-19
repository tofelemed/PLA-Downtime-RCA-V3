import { ExportLabels } from './export-labels';

/**
 * Plain words for the stored keys an export prints (QA audit 2026-10-19: the PDF showed `accepted`,
 * `in force`, `quality`; docs/GLOSSARY.md: the residual is "Unaccounted"). The CSV keeps the raw keys in
 * their own columns for machines and adds these words in `*_label` columns.
 */
const KIND_LABELS: Readonly<Record<string, string>> = {
  schedule_exclusion: 'Schedule exclusion',
  availability: 'Availability',
  performance: 'Performance',
  quality: 'Quality',
  residual: 'Unaccounted',
  gain: 'Gain',
  tolerance_adjustment: 'Tolerance adjustment',
  unaccounted_classified: 'Unaccounted',
  bridge: 'Bridge',
  transition_allowance: 'Transition allowance',
  transition_excess: 'Transition excess',
};

const STATE_LABELS: Readonly<Record<string, string>> = {
  pending: 'Pending',
  accepted: 'Accepted',
  adjusted: 'Adjusted',
  rejected: 'Rejected',
  replaced: 'Replaced',
  in_force: 'In force',
};

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  candidate: 'Calculated',
  manual: 'Manual',
  replace: 'Replacement',
  tolerance: 'Tolerance',
};

const ACTUALS_QUALITY_LABELS: Readonly<Record<string, string>> = {
  complete: 'Complete',
  partial: 'Partial',
  missing: 'Missing',
  conflict: 'Conflict',
};

/** `some_key` → `Some key` for a key without a label (never the raw key with underscores). */
function humanized(key: string): string {
  const words = key.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const labelIn =
  (labels: Readonly<Record<string, string>>) =>
  (key: string | null | undefined): string | null =>
    key ? (labels[key] ?? humanized(key)) : null;

export const kindLabel = labelIn(KIND_LABELS);
export const stateLabel = labelIn(STATE_LABELS);
export const lineSourceLabel = labelIn(SOURCE_LABELS);
export const actualsQualityLabel = labelIn(ACTUALS_QUALITY_LABELS);

/** The pinned code and name of a reason code; null when the line has none or it was not pinned. */
export function reasonOf(
  labels: ExportLabels | null,
  reasonCodeId: string | null,
): { code: string; name: string } | null {
  if (!reasonCodeId || !labels) return null;
  return labels.reasonCodes[reasonCodeId] ?? null;
}

/** `MECH-GEARBOX · Gearbox failure`, else the line's comment, else null. */
export function reasonText(
  labels: ExportLabels | null,
  line: { reasonCodeId: string | null; reason?: string | null },
): string | null {
  const reason = reasonOf(labels, line.reasonCodeId);
  const coded = reason ? `${reason.code} · ${reason.name}` : null;
  const comment = line.reason ?? null;
  if (coded && comment) return `${coded} — ${comment}`;
  return coded ?? comment;
}

const OFFSET = /GMT([+-]\d{2}:\d{2})?/;

/**
 * An instant on the plant clock as ISO 8601 with its offset (`2026-10-17T06:00:00+03:30`), Gregorian and
 * Latin digits so spreadsheets read it as a date-time; null without a zone or an instant.
 */
export function plantIso(
  iso: string | null,
  timezone: string | null,
): string | null {
  if (!iso || !timezone) return null;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-u-ca-gregory-nu-latn', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(instant);
  const read = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const offset = OFFSET.exec(read('timeZoneName'))?.[1] ?? '+00:00';
  return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read('minute')}:${read('second')}${offset}`;
}
