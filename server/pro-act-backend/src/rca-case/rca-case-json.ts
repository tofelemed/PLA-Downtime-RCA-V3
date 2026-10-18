/**
 * Nested content of an RCA case (plan 3.9 step 1): recommendations, evidence items and the logic tree.
 * v1 stored them as JSON text in `rcas`; v2 keeps the same columns and reads both shapes, picking only
 * the known fields (never inventing values: a missing field stays null).
 */
import {
  bool,
  parseArray,
  Raw,
  strings,
  text,
  decimalText,
} from './rca-json-read';

export { parseArray, parseObject, readIds } from './rca-json-read';

export interface RcaRecommendationItem {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  ownerId: string | null;
  dueDate: string | null;
  status: string | null;
  estimatedCost: string | null;
}

export interface RcaEvidenceSeries {
  provider: string | null;
  streams: string | null;
  mode: string | null;
  start: string | null;
  end: string | null;
  interval: string | null;
  intervals: number | null;
  summaryTypes: string | null;
}

export interface RcaEvidenceAttachment {
  fileName: string;
  name: string;
  contentType: string | null;
  size: number | null;
}

export interface RcaEvidenceItem {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  source: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  category: string | null;
  location: string | null;
  occurredAt: string | null;
  assetId: string | null;
  severity: string | null;
  tags: string[];
  verified: boolean | null;
  fiveP: string | null;
  task: string | null;
  taskDueDate: string | null;
  taskStatus: string | null;
  /** F-11: who should collect it */
  taskAssigneeId: string | null;
  /** recorded by the server when `verified` became true */
  verifiedBy: string | null;
  verifiedAt: string | null;
  nodeIds: string[];
  timeSeries: RcaEvidenceSeries | null;
  attachments: RcaEvidenceAttachment[];
}

export interface RcaLogicNode {
  id: string;
  parentId: string | null;
  label: string;
  kind: string | null;
  status: string | null;
  notes: string | null;
  code: string | null;
  description: string | null;
  verified: boolean | null;
}

export function readRecommendations(stored: unknown): RcaRecommendationItem[] {
  return parseArray(stored).map((raw, index) => ({
    id: text(raw.id) ?? `rec-${index + 1}`,
    title: text(raw.title) ?? '',
    description: text(raw.description),
    priority: text(raw.priority),
    ownerId: text(raw.ownerId) ?? text(raw.assigneeId),
    dueDate: text(raw.dueDate),
    status: text(raw.status),
    estimatedCost: decimalText(raw.estimatedCost),
  }));
}

/** v2 `timeSeries` object, or the flat `ts*` fields of the v1 evidence form. */
function readSeries(raw: Raw): RcaEvidenceSeries | null {
  const nested = raw.timeSeries;
  const source: Raw =
    typeof nested === 'object' && nested !== null && !Array.isArray(nested)
      ? (nested as Raw)
      : {
          provider: raw.tsProvider,
          streams: raw.tsStreamsNote,
          mode: raw.tsMode,
          start: raw.tsStart,
          end: raw.tsEnd,
          interval: raw.tsInterval,
          intervals: raw.tsIntervals,
          summaryTypes: raw.tsSummaryTypes,
        };
  const series: RcaEvidenceSeries = {
    provider: text(source.provider),
    streams: text(source.streams),
    mode: text(source.mode),
    start: text(source.start),
    end: text(source.end),
    interval: text(source.interval),
    intervals: typeof source.intervals === 'number' ? source.intervals : null,
    summaryTypes: text(source.summaryTypes),
  };
  return series.start || series.end || series.streams ? series : null;
}

/** Stored attachments (upload references); inline v1 data URLs are not carried. */
function readAttachments(stored: unknown): RcaEvidenceAttachment[] {
  return parseArray(stored)
    .filter((raw) => text(raw.fileName) !== null)
    .map((raw) => ({
      fileName: text(raw.fileName) as string,
      name: text(raw.name) ?? (text(raw.fileName) as string),
      contentType: text(raw.contentType) ?? text(raw.type),
      size: typeof raw.size === 'number' ? raw.size : null,
    }));
}

export function readEvidence(stored: unknown): RcaEvidenceItem[] {
  return parseArray(stored).map((raw, index) => ({
    id: text(raw.id) ?? `ev-${index + 1}`,
    title: text(raw.title) ?? '',
    description: text(raw.description),
    type: text(raw.type),
    source: text(raw.source),
    collectedAt: text(raw.collectedAt),
    collectedBy: text(raw.collectedBy),
    category: text(raw.category),
    location: text(raw.location),
    occurredAt: text(raw.occurredAt) ?? text(raw.timestamp),
    assetId: text(raw.assetId) ?? text(raw.relatedAssetId),
    severity: text(raw.severity),
    tags: strings(raw.tags),
    verified: bool(raw.verified),
    fiveP: text(raw.fiveP),
    task: text(raw.task),
    taskDueDate: text(raw.taskDueDate) ?? text(raw.dueDate),
    taskStatus: text(raw.taskStatus) ?? text(raw.status),
    taskAssigneeId: text(raw.taskAssigneeId),
    verifiedBy: text(raw.verifiedBy),
    verifiedAt: text(raw.verifiedAt),
    nodeIds: strings(raw.nodeIds),
    timeSeries: readSeries(raw),
    attachments: readAttachments(raw.attachments),
  }));
}

/** v2 nodes, and the v1 screen's flat nodes (`question`, `answer`, `type`, `note`, `finding`). */
export function readLogicTree(stored: unknown): RcaLogicNode[] {
  return parseArray(stored).map((raw, index) => ({
    id: text(raw.id) ?? `node-${index + 1}`,
    parentId: text(raw.parentId),
    label:
      text(raw.label) ??
      text(raw.title) ??
      text(raw.question) ??
      text(raw.name) ??
      '',
    kind: text(raw.kind) ?? text(raw.type) ?? text(raw.category),
    status: text(raw.status),
    notes: text(raw.notes) ?? text(raw.note),
    code: text(raw.code),
    description: text(raw.description) ?? text(raw.answer),
    verified: bool(raw.verified) ?? bool(raw.finding),
  }));
}

/** Items without undefined members, as stored JSON text. */
export function writeJson(
  items: readonly unknown[] | undefined,
): string | undefined {
  return items === undefined ? undefined : JSON.stringify(items);
}
