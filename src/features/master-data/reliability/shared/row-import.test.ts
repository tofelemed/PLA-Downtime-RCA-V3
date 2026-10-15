import { describe, expect, it } from 'vitest';
import { V2ApiError } from '@/api/v2/errors';
import { standbyImportSummary, standbyRowOf } from '../standby/standby-import-model';
import { workOrderImportSummary, workOrderRowOf } from '../work-orders/work-order-import-model';
import { isZonedInstant, parseDelimitedRows } from './delimited-rows';
import { mapPastedRows, serverRowProblems } from './row-mapping';

describe('pasted import rows (CSV or JSON)', () => {
  it('reads CSV with quoted cells and a JSON list the same way', () => {
    const csv = parseDelimitedRows('assetCode,notes\nP-1,"Tripped, then ""restarted"""\n\nP-2,');
    expect(csv).toEqual({ rows: [{ assetCode: 'P-1', notes: 'Tripped, then "restarted"' }, { assetCode: 'P-2', notes: '' }], error: null });
    expect(parseDelimitedRows('[{"assetCode":"P-1","waitingSeconds":30,"x":null}]').rows).toEqual([{ assetCode: 'P-1', waitingSeconds: '30', x: '' }]);
  });

  it('names a file it cannot read instead of sending it', () => {
    expect(parseDelimitedRows('  ').error).toBe('Paste the rows first.');
    expect(parseDelimitedRows('assetCode').error).toBe('Add a header line and at least one row.');
    expect(parseDelimitedRows('[1, 2]').error).toBe('The JSON must be a list of objects, one per row.');
    expect(parseDelimitedRows('[{').error).toBe('The JSON is not valid.');
  });

  it('accepts only instants with their offset (a time without a zone is ambiguous)', () => {
    expect(isZonedInstant('2026-10-01T08:00:00Z')).toBe(true);
    expect(isZonedInstant('2026-10-01T08:00+03:30')).toBe(true);
    expect(isZonedInstant('2026-10-01T08:00:00')).toBe(false);
    expect(isZonedInstant('2026-13-01T08:00:00Z')).toBe(false);
  });

  it('maps standby log rows and numbers the problems as the server does (1 = first data row)', () => {
    const text = 'assetCode,kind,startedAt,outcome,externalRef\nP-1B,demand,2026-10-01T08:00:00Z,failed_start,L-1\n,start,2026-10-01 08:00,ok,';
    const mapped = mapPastedRows(text, standbyRowOf);
    expect(mapped.rows[0]).toEqual({ assetCode: 'P-1B', kind: 'demand', startedAt: '2026-10-01T08:00:00Z', endedAt: null, outcome: 'failed_start', externalRef: 'L-1' });
    expect(mapped.problems.map((p) => p.line)).toEqual([2, 2, 2, 2]);
    expect(mapped.problems[0].message).toBe('assetId or assetCode is required');
    expect(JSON.parse(JSON.stringify(mapped.rows[0]))).not.toHaveProperty('notes');
  });

  it('maps CMMS operations: waiting in whole seconds, an asset or a stop required', () => {
    const ok = workOrderRowOf({ workOrderId: '4000123', operationId: '0020', kind: 'repair', startedAt: '2026-10-01T10:00:00Z', endedAt: '2026-10-01T12:00:00Z', waitingSeconds: '1800', assetCode: 'P-101' });
    expect(ok.problems).toEqual([]);
    expect(ok.value).toMatchObject({ waitingSeconds: 1800, assetCode: 'P-101', endedAt: '2026-10-01T12:00:00Z' });
    const bad = workOrderRowOf({ workOrderId: 'W', operationId: '1', kind: 'fix', startedAt: '2026-10-01T10:00:00Z', waitingSeconds: '1.5' });
    expect(bad.problems).toEqual([
      'name the asset (assetId / assetCode) or the stop (eventId)',
      'kind must be one of diagnosis, repair, test, other',
      'waitingSeconds must be a whole number of seconds (0 or more)',
    ]);
  });

  it('reads the server row problems of a 422 and summarizes a stored import', () => {
    const refusal = new V2ApiError(422, { code: 'WORK_ORDER_IMPORT_INVALID', message: 'bad', correlationId: null, retryable: false, details: { errors: [{ line: 3, message: 'the stop belongs to another asset' }, 'junk'] } });
    expect(serverRowProblems(refusal)).toEqual([{ line: 3, message: 'the stop belongs to another asset' }]);
    expect(serverRowProblems(new Error('x'))).toEqual([]);
    expect(workOrderImportSummary({ total: 3, created: 2, updated: 1, linked: 3 })).toBe('Imported 3 operation(s): 2 new, 1 updated, 3 linked to a stop.');
    expect(standbyImportSummary({ total: 1, created: 1, updated: 0 })).toBe('Imported 1 entry: 1 new, 0 replaced (same externalRef).');
  });
});
