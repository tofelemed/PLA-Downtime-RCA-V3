import { describe, expect, it } from 'vitest';
import { StaleRevisionError, toV2Error, V2ApiError } from '@/api/v2/errors';
import type { ProductionEventView } from '@/api/v2/types/events';
import { UNEXPECTED_FIELDS_TEXT } from '@/features/ux-kit/errors/describe-error';
import { changedFields } from './event-draft';
import { currentStopsQuery, defaultFilters, isToCodeFilters, selectionQuery, toCodeFilters, toEventQuery, type EventFilterState } from './event-filters';
import {
  EMPTY_FORM,
  END_BEFORE_START_MESSAGE,
  endBeforeStartError,
  formValuesOf,
  impactedInterval,
  serverFormErrors,
  toCreateBody,
  toPatchBody,
  validateEventForm,
} from './event-form';
import { parseDurationInput } from './duration-input';
import { stateChips } from './event-states';
import { plantLocalToUtc, utcToPlantLocal } from './plant-local-time';

const TEHRAN = 'Asia/Tehran';
const window = { from: '2026-10-08T00:00:00.000Z', to: '2026-10-09T00:00:00.000Z', label: 'Last 24 h' };

const filters = (patch: Partial<EventFilterState> = {}): EventFilterState => ({ ...defaultFilters(window), ...patch });

describe('event filters → v2 query (plan 3.2 step 1)', () => {
  it('maps every filter 1:1 to the v2 parameters and leaves empty ones out', () => {
    const query = toEventQuery(
      filters({
        unitIds: ['u2', 'u1'],
        assetIds: ['a1'],
        reasonIds: ['r1'],
        physicalTypes: ['downtime'],
        scheduleClasses: ['unplanned', 'planned'],
        codingStates: ['uncoded'],
        rcaStates: ['required'],
        isOpen: 'open',
      }),
    );
    expect(query).toEqual({
      sort: '-startTime',
      unitIds: ['u1', 'u2'],
      assetIds: ['a1'],
      reasonIds: ['r1'],
      physicalTypes: ['downtime'],
      scheduleClasses: ['planned', 'unplanned'],
      physicalStates: ['closed', 'open'],
      codingStates: ['uncoded'],
      rcaStates: ['required'],
      from: window.from,
      to: window.to,
      isOpen: true,
    });
    expect(toEventQuery(filters({ isOpen: 'closed' })).isOpen).toBe(false);
    expect(toEventQuery(filters()).unitIds).toBeUndefined();
    expect('isOpen' in toEventQuery(filters())).toBe(false);
  });

  it('gives the same query for the same selection in any order (stable cache key)', () => {
    expect(toEventQuery(filters({ unitIds: ['b', 'a'] }))).toEqual(toEventQuery(filters({ unitIds: ['a', 'b'] })));
  });

  it('FE-07 "To code": uncoded live stops of the same units and window; other narrowing dropped', () => {
    const next = toCodeFilters(filters({ unitIds: ['u1'], reasonIds: ['r1'], physicalTypes: ['slowdown'], physicalStates: [], q: 'belt' }));
    expect(next).toMatchObject({ unitIds: ['u1'], from: window.from, to: window.to, physicalTypes: ['downtime'], codingStates: ['uncoded'], physicalStates: ['open', 'closed'], reasonIds: [], q: '' });
  });

  it('recognises the "To code" preset for its empty text (E-L6)', () => {
    const preset = toCodeFilters(filters({ unitIds: ['u1'], q: 'belt' }));
    expect(isToCodeFilters(preset)).toBe(true);
    expect(isToCodeFilters({ ...preset, unitIds: ['u1'], windowLabel: 'Shift A' })).toBe(true);
    expect(isToCodeFilters(filters())).toBe(false);
    expect(isToCodeFilters({ ...preset, reasonIds: ['r1'] })).toBe(false);
  });

  it('SME D13 "all matching": the list filters without paging and sort; a window is required', () => {
    const query = selectionQuery(filters({ unitIds: ['u1'], codingStates: ['uncoded'] }));
    expect(query).toMatchObject({ unitIds: ['u1'], codingStates: ['uncoded'], from: window.from, to: window.to });
    expect(query).not.toHaveProperty('limit');
    expect(query).not.toHaveProperty('sort');
    expect(selectionQuery(filters({ from: null }))).toBeNull();
  });

  it('current stops: open events of the chosen units, independent of the window', () => {
    expect(currentStopsQuery(filters({ unitIds: ['u1'] }))).toEqual({
      limit: 50,
      sort: '-startTime',
      isOpen: true,
      physicalStates: ['open'],
      unitIds: ['u1'],
    });
  });
});

describe('plant clock input (D03)', () => {
  it('converts plant wall time to UTC and back (Tehran +03:30)', () => {
    expect(plantLocalToUtc('2026-10-09T08:30', TEHRAN)).toBe('2026-10-09T05:00:00.000Z');
    expect(utcToPlantLocal('2026-10-09T05:00:00.000Z', TEHRAN)).toBe('2026-10-09T08:30');
    expect(plantLocalToUtc('not a time', TEHRAN)).toBeNull();
  });

  it('follows DST rules of the zone (New York summer and winter)', () => {
    expect(plantLocalToUtc('2026-07-01T08:00', 'America/New_York')).toBe('2026-07-01T12:00:00.000Z');
    expect(plantLocalToUtc('2026-12-01T08:00', 'America/New_York')).toBe('2026-12-01T13:00:00.000Z');
  });
});

describe('event form (plan 3.2 step 3)', () => {
  const values = { ...EMPTY_FORM, unitId: 'u1', startLocal: '2026-10-09T08:00', intervalMode: 'duration' as const, durationMinutes: '45' };

  it('checks only the request shape: required unit/start, parseable times, a readable duration', () => {
    expect(validateEventForm(EMPTY_FORM, 'create', TEHRAN)).toEqual({ unitId: 'Choose a unit', startLocal: 'Enter the start time' });
    expect(validateEventForm({ ...values, durationMinutes: '-1' }, 'create', TEHRAN).durationMinutes).toBeDefined();
    expect(validateEventForm({ ...values, durationMinutes: 'x' }, 'create', TEHRAN).durationMinutes).toBeDefined();
    // in duration mode a left-over end time is not sent, so it is not checked
    expect(validateEventForm({ ...values, endLocal: '2026-10-09T07:00' }, 'create', TEHRAN)).toEqual({});
  });

  it('QA audit F3: an end time at or before the start is refused at the End field before saving', () => {
    const timed = { ...values, intervalMode: 'end' as const, durationMinutes: '' };
    expect(validateEventForm({ ...timed, endLocal: '2026-10-01T08:00' }, 'create', TEHRAN)).toEqual({ endLocal: END_BEFORE_START_MESSAGE });
    expect(validateEventForm({ ...timed, endLocal: '2026-10-09T08:00' }, 'edit', TEHRAN)).toEqual({ endLocal: END_BEFORE_START_MESSAGE });
    expect(validateEventForm({ ...timed, endLocal: '2026-10-09T08:01' }, 'create', TEHRAN)).toEqual({});
    expect(endBeforeStartError({ ...timed, endLocal: '' }, TEHRAN)).toBeNull();
    // the server's 422 lands on the same field
    const refused = new V2ApiError(422, {
      code: 'END_BEFORE_START',
      message: 'endTime must be after startTime',
      fieldErrors: [{ field: 'endTime', message: 'endTime must be after startTime' }],
      correlationId: 'c9',
      retryable: false,
    });
    expect(serverFormErrors(refused).fields).toEqual({ endLocal: 'endTime must be after startTime' });
  });

  it('the impacted-periods preview reads the end time or start + duration, and nothing for a reversed range (F3, L8)', () => {
    const timed = { ...values, intervalMode: 'end' as const };
    expect(impactedInterval({ ...timed, endLocal: '2026-10-09T09:00' }, TEHRAN)).toEqual({ from: '2026-10-09T04:30:00.000Z', to: '2026-10-09T05:30:00.000Z' });
    expect(impactedInterval({ ...timed, endLocal: '2026-10-09T07:00' }, TEHRAN)).toBeNull();
    expect(impactedInterval({ ...timed, endLocal: '' }, TEHRAN)).toEqual({ from: '2026-10-09T04:30:00.000Z', to: null });
    // duration mode ignores a stale end time
    expect(impactedInterval({ ...values, endLocal: '2026-10-09T07:00' }, TEHRAN)).toEqual({ from: '2026-10-09T04:30:00.000Z', to: '2026-10-09T05:15:00.000Z' });
    expect(impactedInterval({ ...values, startLocal: '' }, TEHRAN)).toBeNull();
  });

  it('sends minutes as seconds and plant times as UTC (DTO §15.3)', () => {
    expect(parseDurationInput('1.5')).toBe(90);
    expect(parseDurationInput('')).toBeNull();
    expect(toCreateBody({ ...values, reasonCodeId: 'r1', description: '  belt  ' }, TEHRAN)).toEqual({
      unitId: 'u1',
      startTime: '2026-10-09T04:30:00.000Z',
      physicalType: 'downtime',
      durationSeconds: 2700,
      reasonCodeId: 'r1',
      description: 'belt',
    });
  });

  it('SME D8 / D11: failure detail is sent when filled, trimmed, and cleared with null on edit', () => {
    const failed = { ...values, failureMode: ' Seal leak ', failureSeverity: 'critical', maintainableItem: 'Seal' };
    expect(toCreateBody(failed, TEHRAN)).toMatchObject({ failureMode: 'Seal leak', failureSeverity: 'critical', maintainableItem: 'Seal' });
    expect(toCreateBody(values, TEHRAN)).not.toHaveProperty('failureSeverity');
    const initial = { ...failed, durationMinutes: '' };
    expect(toPatchBody(initial, { ...initial, failureSeverity: '', failureCause: 'Flush' }, TEHRAN)).toEqual({ failureSeverity: null, failureCause: 'Flush' });
  });

  it('SME D4: the approved planned end is sent on the plant clock as UTC and cleared with null on edit', () => {
    const planned = { ...values, scheduleClass: 'planned', plannedEndLocal: '2026-10-09T10:00' };
    expect(toCreateBody(planned, TEHRAN)).toMatchObject({ plannedEndTime: '2026-10-09T06:30:00.000Z' });
    expect(toCreateBody(values, TEHRAN)).not.toHaveProperty('plannedEndTime');
    const initial = { ...planned, durationMinutes: '' };
    expect(toPatchBody(initial, { ...initial, plannedEndLocal: '' }, TEHRAN)).toEqual({ plannedEndTime: null });
    expect(validateEventForm({ ...planned, plannedEndLocal: 'not a time' }, 'create', TEHRAN).plannedEndLocal).toBeDefined();
  });

  it('SME D3: the origin unit / asset is sent when chosen and cleared with null on edit', () => {
    expect(toCreateBody({ ...values, originUnitId: 'u2', originAssetId: 'a9' }, TEHRAN)).toMatchObject({ originUnitId: 'u2', originAssetId: 'a9' });
    expect(toCreateBody(values, TEHRAN)).not.toHaveProperty('originUnitId');
    const initial = { ...values, durationMinutes: '', originUnitId: 'u2', originAssetId: 'a9' };
    expect(toPatchBody(initial, { ...initial, originUnitId: '', originAssetId: '' }, TEHRAN)).toEqual({ originUnitId: null, originAssetId: null });
    expect(toPatchBody(initial, { ...initial, originAssetId: 'a7' }, TEHRAN)).toEqual({ originAssetId: 'a7' });
  });

  it('Marun E2E: the change reason travels with a real change only (clearing a reason sends null)', () => {
    const initial = { ...values, durationMinutes: '', reasonCodeId: 'speed-loss' };
    expect(toPatchBody(initial, { ...initial, reasonCodeId: '', changeReason: '  Coded by mistake  ' }, TEHRAN)).toEqual({ reasonCodeId: null, changeReason: 'Coded by mistake' });
    expect(toPatchBody(initial, { ...initial, changeReason: 'nothing else changed' }, TEHRAN)).toEqual({});
    expect(toPatchBody(initial, { ...initial, reasonCodeId: '', changeReason: '   ' }, TEHRAN)).toEqual({ reasonCodeId: null });
  });

  it('PATCH carries only changed fields; a duration alone re-derives the end', () => {
    const event = {
      unitId: 'u1',
      startTime: '2026-10-09T04:30:00.000Z',
      endTime: '2026-10-09T05:30:00.000Z',
      classification: { physicalType: 'downtime', scheduleClass: 'unplanned' },
      reasonCodeId: null,
      description: null,
    } as unknown as ProductionEventView;
    const initial = formValuesOf(event, TEHRAN);
    expect(toPatchBody(initial, { ...initial, reasonCodeId: 'r2' }, TEHRAN)).toEqual({ reasonCodeId: 'r2' });
    expect(toPatchBody(initial, { ...initial, intervalMode: 'duration', durationMinutes: '30' }, TEHRAN)).toEqual({ durationSeconds: 1800, endTime: null });
    expect(changedFields(initial, { ...initial, description: 'x' })).toEqual(['description']);
  });

  it('production impact of a stop: full, partial with a percentage, or none (SME Q5)', () => {
    expect(toCreateBody(values, TEHRAN)).not.toHaveProperty('impactMode');
    expect(toCreateBody({ ...values, impactMode: 'fractional', impactPercent: '40' }, TEHRAN)).toMatchObject({
      impactMode: 'fractional',
      impactFraction: '0.4',
    });
    const none = toCreateBody({ ...values, impactMode: 'none', impactPercent: '40' }, TEHRAN);
    expect(none).toMatchObject({ impactMode: 'none' });
    expect(none).not.toHaveProperty('impactFraction');
    expect(validateEventForm({ ...values, impactMode: 'fractional', impactPercent: '' }, 'create', TEHRAN).impactPercent).toBeDefined();
    expect(validateEventForm({ ...values, impactMode: 'fractional', impactPercent: '120' }, 'create', TEHRAN).impactPercent).toBeDefined();
    const partial = {
      unitId: 'u1',
      startTime: '2026-10-09T04:30:00.000Z',
      endTime: '2026-10-09T05:30:00.000Z',
      classification: { physicalType: 'downtime', scheduleClass: 'unplanned', impactMode: 'fractional', impactFraction: '0.25' },
      reasonCodeId: null,
      description: null,
    } as unknown as ProductionEventView;
    const initial = formValuesOf(partial, TEHRAN);
    expect(initial).toMatchObject({ impactMode: 'fractional', impactPercent: '25' });
    expect(toPatchBody(initial, { ...initial, impactMode: 'full_stop' }, TEHRAN)).toEqual({ impactMode: 'full_stop', impactFraction: null });
  });

  it('maps 422 field errors onto the inputs (DURATION_CONFLICT → duration) and 412 to the conflict flow', () => {
    const conflict = new V2ApiError(422, {
      code: 'DURATION_CONFLICT',
      message: 'endTime and durationSeconds disagree',
      fieldErrors: [{ field: 'durationSeconds', message: 'Duration does not match the end' }],
      correlationId: 'c1',
      retryable: false,
    });
    const mapped = serverFormErrors(conflict);
    expect(mapped.fields).toEqual({ durationMinutes: 'Duration does not match the end' });
    expect(mapped.form).toMatch(/· Duration[^:]*: Duration does not match the end$/);
    const extra = new V2ApiError(422, {
      code: 'VALIDATION_FAILED',
      message: 'property changeReason should not exist',
      fieldErrors: [{ field: 'changeReason', message: 'property changeReason should not exist', constraint: 'whitelistValidation' }],
      correlationId: 'c3',
      retryable: false,
    });
    expect(serverFormErrors(extra)).toEqual({
      fields: {},
      form: `Some values were not accepted. ${UNEXPECTED_FIELDS_TEXT} · Unexpected field: changeReason`,
    });
    const owned = new V2ApiError(409, { code: 'SOURCE_OWNED', message: 'owned by source', correlationId: null, retryable: false });
    expect(serverFormErrors(owned).form).toBe('This value comes from the connected source. It is updated by the source system and cannot be edited here.');
    const listed = toV2Error(422, { code: 'END_BEFORE_START', message: ['endTime must be after startTime'] }, null, 'c2');
    expect(listed.message).toBe('endTime must be after startTime');
    const stale = new StaleRevisionError({ code: 'STALE_REVISION', message: 'stale', correlationId: null, retryable: false }, 4);
    expect(serverFormErrors(stale)).toEqual({ fields: {}, form: null });
  });
});

describe('state chips (DT11)', () => {
  it('shows the three server states with text labels; unknown values humanized, never hidden', () => {
    const chips = stateChips({ physical: 'open', coding: 'uncoded', rca: 'mystery_state' });
    expect(chips.map((chip) => chip.label)).toEqual(['Ongoing', 'Uncoded', 'Mystery state']);
    expect(chips.map((chip) => chip.dimension)).toEqual(['physical', 'coding', 'rca']);
  });
});
