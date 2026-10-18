import { plantDayOf } from './plant-day';
import type { RcaEvidenceAttachment, RcaEvidenceItem, RcaEvidenceSeries } from '@/api/v2/types/rca';

export const EVIDENCE_TYPES = ['Photo', 'Document', 'Video', 'Note', 'Time Series'] as const;
export const FIVE_P = ['Parts', 'Paper', 'People', 'Place', 'Process'] as const;
export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const SERIES_MODES = ['recorded', 'interpolated', 'summary', 'plot'] as const;

/** What the evidence page edits; text fields hold '' for "not stated". */
export interface EvidenceForm {
  title: string;
  description: string;
  type: string;
  source: string;
  category: string;
  location: string;
  /** ISO instant or null */
  occurredAt: string | null;
  assetId: string;
  severity: string;
  /** comma separated */
  tags: string;
  verified: boolean;
  fiveP: string;
  task: string;
  /** ISO calendar date or '' */
  taskDueDate: string;
  taskStatus: 'pending' | 'completed';
  /** a member of the plant who collects the evidence ('' = not assigned) */
  taskAssigneeId: string;
  series: SeriesForm;
  attachments: RcaEvidenceAttachment[];
}

export interface SeriesForm {
  streams: string;
  mode: string;
  start: string | null;
  end: string | null;
  interval: string;
  intervals: string;
  summaryTypes: string;
}

const EMPTY_SERIES: SeriesForm = { streams: '', mode: 'interpolated', start: null, end: null, interval: '', intervals: '100', summaryTypes: '' };

export const EMPTY_EVIDENCE_FORM: EvidenceForm = {
  title: '',
  description: '',
  type: 'Note',
  source: '',
  category: '',
  location: '',
  occurredAt: null,
  assetId: '',
  severity: 'Medium',
  tags: '',
  verified: false,
  fiveP: 'Parts',
  task: '',
  taskDueDate: '',
  taskStatus: 'pending',
  taskAssigneeId: '',
  series: EMPTY_SERIES,
  attachments: [],
};

function seriesForm(series: RcaEvidenceSeries | null): SeriesForm {
  if (!series) return EMPTY_SERIES;
  return {
    streams: series.streams ?? '',
    mode: series.mode ?? 'interpolated',
    start: series.start,
    end: series.end,
    interval: series.interval ?? '',
    intervals: series.intervals === null ? '' : String(series.intervals),
    summaryTypes: series.summaryTypes ?? '',
  };
}

/** The form of a stored evidence item; a task due instant shows as the plant's day. */
export function evidenceFormOf(item: RcaEvidenceItem, timeZone: string): EvidenceForm {
  return {
    title: item.title,
    description: item.description ?? '',
    type: item.type ?? 'Note',
    source: item.source ?? '',
    category: item.category ?? '',
    location: item.location ?? '',
    occurredAt: item.occurredAt,
    assetId: item.assetId ?? '',
    severity: item.severity ?? 'Medium',
    tags: item.tags.join(', '),
    verified: item.verified === true,
    fiveP: item.fiveP ?? 'Parts',
    task: item.task ?? '',
    taskDueDate: plantDayOf(item.taskDueDate, timeZone),
    taskStatus: item.taskStatus === 'completed' ? 'completed' : 'pending',
    taskAssigneeId: item.taskAssigneeId ?? '',
    series: seriesForm(item.timeSeries),
    attachments: item.attachments,
  };
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

function seriesOf(form: EvidenceForm): RcaEvidenceSeries | null {
  if (form.type !== 'Time Series') return null;
  const intervals = Number.parseInt(form.series.intervals, 10);
  return {
    provider: 'pi',
    streams: orNull(form.series.streams),
    mode: form.series.mode,
    start: form.series.start,
    end: form.series.end,
    interval: orNull(form.series.interval),
    intervals: Number.isFinite(intervals) && intervals > 0 ? intervals : null,
    summaryTypes: orNull(form.series.summaryTypes),
  };
}

/** Provenance kept from the stored item (verifiedBy / verifiedAt are recorded by the server; sent back, they are ignored). */
export type EvidenceBase = Pick<RcaEvidenceItem, 'id' | 'collectedAt' | 'collectedBy' | 'nodeIds' | 'verifiedBy' | 'verifiedAt'>;

/** The stored item: the previous item's links (node ids) and provenance are kept as they were. */
export function evidenceItemOf(form: EvidenceForm, base: EvidenceBase): RcaEvidenceItem {
  return {
    id: base.id,
    collectedAt: base.collectedAt,
    collectedBy: base.collectedBy,
    nodeIds: base.nodeIds,
    verifiedBy: base.verifiedBy,
    verifiedAt: base.verifiedAt,
    title: form.title.trim(),
    description: orNull(form.description),
    type: form.type,
    source: orNull(form.source),
    category: orNull(form.category),
    location: orNull(form.location),
    occurredAt: form.occurredAt,
    assetId: orNull(form.assetId),
    severity: form.severity,
    tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    verified: form.verified,
    fiveP: form.fiveP,
    task: orNull(form.task),
    taskDueDate: form.taskDueDate || null,
    taskStatus: form.taskStatus,
    taskAssigneeId: form.taskAssigneeId || null,
    timeSeries: seriesOf(form),
    attachments: form.attachments,
  };
}

/** "Verified by Sara Karimi at …" from the server-recorded fields (older items carry only the flag). */
export function verifiedText(item: Pick<RcaEvidenceItem, 'verified' | 'verifiedBy' | 'verifiedAt'>, nameOf: (id: string) => string, dateTime: (iso: string) => string): string {
  if (!item.verified) return 'No';
  const by = item.verifiedBy ? ` by ${nameOf(item.verifiedBy)}` : '';
  const at = item.verifiedAt ? ` at ${dateTime(item.verifiedAt)}` : '';
  return by || at ? `Verified${by}${at}` : 'Yes';
}
