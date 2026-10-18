import { describe, expect, it } from 'vitest';
import { V2ApiError } from '@/api/v2/errors';
import type { ProductionEventView } from '@/api/v2/types/events';
import { invalidReferenceIds, sharedUnitOf } from './bulk-targets';
import { hasBulkCode, toBulkBody, type InvestigationChoice } from '../hooks/use-bulk-code-flow';
import { defaultFilters, nextSortOf, selectionQuery, toEventQuery } from './event-filters';
import { parseEventFilters, toEventSearchParams } from './event-url';
import { ownedFieldsOf, sourceOwnershipOf, withoutSourceInterval } from './source-ownership';

const NOW = Date.parse('2026-10-18T06:00:00.000Z');
const WINDOW = { from: '2026-10-15T00:00:00.000Z', to: '2026-10-16T00:00:00.000Z', label: 'Custom window' };

describe('E-1 list order and minimum duration', () => {
  it('maps each order to one v2 sort, newest first by default', () => {
    const base = defaultFilters(WINDOW);
    expect(toEventQuery(base).sort).toBe('-startTime');
    expect(toEventQuery({ ...base, sort: 'oldest' }).sort).toBe('startTime');
    expect(toEventQuery({ ...base, sort: 'longest' }).sort).toBe('-durationSeconds');
    expect(toEventQuery({ ...base, sort: 'shortest' }).sort).toBe('durationSeconds');
  });

  it('keeps one sort and the minimum duration in the URL and reads them back', () => {
    const state = { ...defaultFilters(WINDOW), sort: 'longest' as const, minDurationSeconds: 1800 };
    const params = toEventSearchParams(state);
    expect(params.get('sort')).toBe('longest');
    expect(params.get('minDuration')).toBe('1800');
    const parsed = parseEventFilters(params, NOW);
    expect(parsed).toMatchObject({ sort: 'longest', minDurationSeconds: 1800 });
    expect(toEventQuery(parsed)).toMatchObject({ sort: '-durationSeconds', minDurationSeconds: 1800 });
    expect(toEventSearchParams(defaultFilters(WINDOW)).has('sort')).toBe(false);
  });

  it('ignores an unknown sort and a malformed minimum duration', () => {
    const parsed = parseEventFilters(new URLSearchParams('window=24h&sort=random&minDuration=-5'), NOW);
    expect(parsed.sort).toBe('newest');
    expect(parsed.minDurationSeconds).toBeNull();
    expect(toEventQuery(parsed)).not.toHaveProperty('minDurationSeconds');
    expect(parseEventFilters(new URLSearchParams('window=24h&minDuration=1.5'), NOW).minDurationSeconds).toBeNull();
  });

  it('a header click picks its first order unless it already sorts, then flips', () => {
    expect(nextSortOf('newest', ['longest', 'shortest'])).toBe('longest');
    expect(nextSortOf('longest', ['longest', 'shortest'])).toBe('shortest');
    expect(nextSortOf('shortest', ['longest', 'shortest'])).toBe('longest');
    expect(nextSortOf('longest', ['newest', 'oldest'])).toBe('newest');
  });

  it('the selection snapshot carries the new filters but no sort', () => {
    const state = { ...defaultFilters(WINDOW), sort: 'longest' as const, minDurationSeconds: 300, verificationStates: ['not_verified'] };
    const query = selectionQuery(state);
    expect(query).toMatchObject({ minDurationSeconds: 300, verificationStates: ['not_verified'] });
    expect(query).not.toHaveProperty('sort');
  });
});

describe('E-7 verification filter', () => {
  it('round-trips verified / not verified through the URL into verificationStates', () => {
    const state = { ...defaultFilters(WINDOW), verificationStates: ['not_verified'] };
    const params = toEventSearchParams(state);
    expect(params.get('verified')).toBe('not_verified');
    expect(toEventQuery(parseEventFilters(params, NOW)).verificationStates).toEqual(['not_verified']);
    expect(toEventQuery(defaultFilters(WINDOW))).not.toHaveProperty('verificationStates');
  });
});

describe('bulk coding asset and investigation pending (A-1, SME D12)', () => {
  const events = [
    { id: 'e1', rowVersion: 1, unitId: 'u1', startTime: 'a', endTime: null },
    { id: 'e2', rowVersion: 4, unitId: 'u1', startTime: 'b', endTime: null },
  ];

  it('sends assetId and investigationPending only when chosen', () => {
    const codes = { reasonCodeId: '', scheduleClass: '', oeeComponent: '', assetId: 'a1', investigationPending: 'set' as const };
    expect(toBulkBody(events, codes, ' why ', true)).toEqual({
      items: [{ eventId: 'e1', expectedVersion: 1 }, { eventId: 'e2', expectedVersion: 4 }],
      codes: { assetId: 'a1', investigationPending: true },
      reason: 'why',
      preview: true,
    });
    expect(toBulkBody(events, { ...codes, assetId: '', investigationPending: 'unchanged', reasonCodeId: 'r1' }, 'x', false).codes).toEqual({ reasonCodeId: 'r1' });
  });

  it('sends investigationPending for the three choices: omitted, true, false', () => {
    const base = { reasonCodeId: '', scheduleClass: '', oeeComponent: '', assetId: '' };
    const codesFor = (investigationPending: InvestigationChoice) => toBulkBody(events, { ...base, investigationPending }, 'x', true).codes;
    expect(codesFor('unchanged')).toEqual({});
    expect(codesFor('unchanged')).not.toHaveProperty('investigationPending');
    expect(codesFor('set')).toEqual({ investigationPending: true });
    expect(codesFor('clear')).toEqual({ investigationPending: false });
  });

  it('counts "Clear investigation pending" alone as a change, "Leave unchanged" alone as none', () => {
    const base = { reasonCodeId: '', scheduleClass: '', oeeComponent: '', assetId: '' };
    expect(hasBulkCode({ ...base, investigationPending: 'unchanged' })).toBe(false);
    expect(hasBulkCode({ ...base, investigationPending: 'clear' })).toBe(true);
    expect(hasBulkCode({ ...base, investigationPending: 'set' })).toBe(true);
  });

  it('offers the asset only for events of one unit', () => {
    expect(sharedUnitOf(events)).toBe('u1');
    expect(sharedUnitOf([...events, { ...events[0], id: 'e3', unitId: 'u2' }])).toBeNull();
    expect(sharedUnitOf([])).toBeNull();
  });

  it('reads the event ids of a 422 INVALID_REFERENCE only', () => {
    const refused = new V2ApiError(422, { code: 'INVALID_REFERENCE', message: 'x', correlationId: null, retryable: false, details: { eventIds: ['e2', 7] } });
    expect(invalidReferenceIds(refused)).toEqual(['e2']);
    expect(invalidReferenceIds(new V2ApiError(422, { code: 'VALIDATION_FAILED', message: 'x', correlationId: null, retryable: false }))).toEqual([]);
    expect(invalidReferenceIds(new Error('x'))).toEqual([]);
  });
});

describe('E-5 source-owned fields', () => {
  const event: Pick<ProductionEventView, 'source' | 'sourceOwnedFields'> = {
    source: 'PI',
    sourceOwnedFields: ['startTime', 'endTime', 'durationSeconds', 'assetId', 'description'],
  };

  it('splits the server list into the read-only interval and overridable fields', () => {
    const ownership = sourceOwnershipOf(event);
    expect(ownership.source).toBe('PI');
    expect(ownership.intervalOwned).toBe(true);
    expect([...ownership.overridable]).toEqual(['assetId', 'description']);
    expect(ownedFieldsOf(ownership, ['quantity', 'assetId'])).toEqual(['assetId']);
  });

  it('owns nothing for a manual event, a create form or an older server', () => {
    expect(sourceOwnershipOf({ source: null, sourceOwnedFields: [] })).toMatchObject({ intervalOwned: false });
    expect(sourceOwnershipOf(null).overridable.size).toBe(0);
    expect(sourceOwnershipOf({ source: 'PI' }).intervalOwned).toBe(false);
    expect(sourceOwnershipOf({ source: ' ', sourceOwnedFields: ['startTime'] }).source).toBe('the source system');
  });

  it('never sends a source-owned interval in a PATCH', () => {
    const changes = { startTime: 'x', endTime: null, durationSeconds: 60, description: 'belt' };
    expect(withoutSourceInterval(changes, { intervalOwned: true })).toEqual({ description: 'belt' });
    expect(withoutSourceInterval(changes, { intervalOwned: false })).toBe(changes);
  });
});
