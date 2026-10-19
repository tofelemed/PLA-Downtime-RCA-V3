import type { WorkOrderImportResult, WorkOrderOperationRow } from '@/api/v2/types/reliability';
import { optional, type TextRow } from '../shared/delimited-rows';
import { choiceProblem, instantProblem, type MappedRow } from '../shared/row-mapping';
import { plural } from '@/features/ux-kit/format/plural';

export const WORK_ORDER_CSV_HEADER = 'workOrderId,operationId,kind,startedAt,endedAt,waitingSeconds,waitingReason,assetCode,eventId,description,source';
/** The columns in plain words (help text of the import panel). */
export const WORK_ORDER_CSV_COLUMNS =
  'work order number, operation number, kind (diagnosis, repair, test or other), start and end time (ISO 8601 with offset), waiting time in seconds, waiting reason, asset code or stop, description and source system';
export const WORK_ORDER_CSV_EXAMPLE =
  `${WORK_ORDER_CSV_HEADER}\n4000123,0020,repair,2026-10-01T10:00:00Z,2026-10-01T12:00:00Z,1800,Seal kit from store,P-101,,Replace seal,SAP PM`;

const KINDS = ['diagnosis', 'repair', 'test', 'other'] as const;

function waitingOf(row: TextRow): { value: number | undefined; problems: string[] } {
  const text = row.waitingSeconds ?? '';
  if (!text) return { value: undefined, problems: [] };
  const value = Number(text);
  return Number.isInteger(value) && value >= 0
    ? { value, problems: [] }
    : { value: undefined, problems: ['waitingSeconds must be a whole number of seconds (0 or more)'] };
}

/** One CMMS operation row as the import API takes it (actual operation times, never work-order dates). */
export function workOrderRowOf(row: TextRow): MappedRow<WorkOrderOperationRow> {
  const waiting = waitingOf(row);
  const problems = [
    ...(row.workOrderId ? [] : ['workOrderId is required']),
    ...(row.operationId ? [] : ['operationId is required']),
    ...(row.assetId || row.assetCode || row.eventId ? [] : ['name the asset (assetId / assetCode) or the stop (eventId)']),
    ...choiceProblem(row, 'kind', KINDS),
    ...instantProblem(row, 'startedAt', true),
    ...instantProblem(row, 'endedAt', false),
    ...waiting.problems,
  ];
  const value: WorkOrderOperationRow = {
    workOrderId: row.workOrderId ?? '',
    operationId: row.operationId ?? '',
    kind: row.kind as WorkOrderOperationRow['kind'],
    startedAt: row.startedAt ?? '',
    endedAt: optional(row, 'endedAt') ?? null,
    waitingSeconds: waiting.value,
    waitingReason: optional(row, 'waitingReason'),
    assetId: optional(row, 'assetId'),
    assetCode: row.assetId ? undefined : optional(row, 'assetCode'),
    eventId: optional(row, 'eventId'),
    description: optional(row, 'description'),
    source: optional(row, 'source'),
  };
  return { value, problems };
}

export const workOrderImportSummary = (r: WorkOrderImportResult) =>
  `Imported ${plural(r.total, 'operation', 'operations')}: ${r.created} new, ${r.updated} updated, ${r.linked} linked to a stop.`;
