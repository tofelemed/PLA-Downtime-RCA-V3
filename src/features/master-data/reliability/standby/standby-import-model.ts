import type { StandbyImportResult, StandbyRecordRow } from '@/api/v2/types/reliability';
import { optional, type TextRow } from '../shared/delimited-rows';
import { choiceProblem, instantProblem, type MappedRow } from '../shared/row-mapping';

export const STANDBY_CSV_HEADER = 'assetCode,kind,startedAt,endedAt,outcome,externalRef,notes';
export const STANDBY_CSV_EXAMPLE = `${STANDBY_CSV_HEADER}\nP-101B,demand,2026-10-01T08:00:00Z,2026-10-01T08:00:30Z,success,LOG-1,Duty pump tripped`;

const KINDS = ['demand', 'test', 'run'] as const;
const OUTCOMES = ['success', 'failed_start', 'failed_while_running'] as const;

/** One log row as the import API takes it; the asset by id or code. */
export function standbyRowOf(row: TextRow): MappedRow<StandbyRecordRow> {
  const problems = [
    ...(row.assetId || row.assetCode ? [] : ['assetId or assetCode is required']),
    ...choiceProblem(row, 'kind', KINDS),
    ...choiceProblem(row, 'outcome', OUTCOMES),
    ...instantProblem(row, 'startedAt', true),
    ...instantProblem(row, 'endedAt', false),
  ];
  const value: StandbyRecordRow = {
    assetId: optional(row, 'assetId'),
    assetCode: row.assetId ? undefined : optional(row, 'assetCode'),
    kind: row.kind as StandbyRecordRow['kind'],
    startedAt: row.startedAt ?? '',
    endedAt: optional(row, 'endedAt') ?? null,
    outcome: row.outcome as StandbyRecordRow['outcome'],
    eventId: optional(row, 'eventId'),
    externalRef: optional(row, 'externalRef'),
    notes: optional(row, 'notes'),
  };
  return { value, problems };
}

export const standbyImportSummary = (r: StandbyImportResult) =>
  `Imported ${r.total} entr${r.total === 1 ? 'y' : 'ies'}: ${r.created} new, ${r.updated} replaced (same externalRef).`;
