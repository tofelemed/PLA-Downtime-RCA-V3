import { describe, expect, it } from 'vitest';
import { StaleRevisionError, toV2Error } from '@/api/v2/errors';
import type { CalendarVersionView } from '@/api/v2/types/calendars';
import { calendarCreateBody, definitionOf, draftOf, newCalendarDraft, validateCalendarDraft } from './model/calendar-draft';
import { offsetLabel, warningsByRow, warningsOf } from './model/calendar-preview';
import { cycleOf, cycleText } from './model/crew-cycle';
import { copiedPlanValues, emptyPlanForm, isOpenVersion, planCreateBody, sumMatchesHeader, validatePlanForm } from './model/plan-form';
import { emptyProfileForm, profileCreateBody, rateCreateBody, validateProfileForm, validateRateForm, validateValuationForm, valuationCreateBody } from './model/profile-form';
import { plainFieldMessage, refusalOf } from './model/refusal';

const TEHRAN = 'Asia/Tehran';

describe('refusals (plan 3.4: 403 / 409 / 412 / 422 shown as the server said)', () => {
  it('409 VERSION_OVERLAP lists the conflicting versions from details.conflicts', () => {
    const error = toV2Error(409, {
      code: 'VERSION_OVERLAP',
      message: 'the rate overlaps approved version(s) v1',
      correlationId: 'c-1',
      retryable: false,
      details: { conflicts: [{ id: 'r1', version: 1, effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: null }] },
    }, null, null);
    const refusal = refusalOf(error);
    expect(refusal).toMatchObject({ kind: 'conflict', code: 'VERSION_OVERLAP', correlationId: 'c-1' });
    expect(refusal?.conflicts).toEqual([{ id: 'r1', label: 'Version 1', from: '2026-10-01T02:30:00.000Z', to: null }]);
  });

  it('409 PLAN_OVERLAP names the other plan version and its interval', () => {
    const error = toV2Error(409, {
      code: 'PLAN_OVERLAP', message: 'overlap', correlationId: null, retryable: false,
      details: { conflicts: [{ planId: 'abcdef12-0000', version: 2, productId: 'p', activeFrom: '2026-11-01T02:30:00.000Z', activeTo: '2026-11-02T02:30:00.000Z' }] },
    }, null, null);
    expect(refusalOf(error)?.conflicts[0]).toEqual({ id: 'abcdef12-0000', label: 'Another approved plan (version 2)', from: '2026-11-01T02:30:00.000Z', to: '2026-11-02T02:30:00.000Z' });
  });

  it('role, scope and duty refusals are told apart; 412 is stale; 422 carries field errors', () => {
    const of = (status: number, code: string) => refusalOf(toV2Error(status, { code, message: code, correlationId: null, retryable: false }, null, null));
    expect(of(403, 'FORBIDDEN_ROLE')?.kind).toBe('role');
    expect(of(403, 'READ_ONLY_ROLE')).toMatchObject({ kind: 'role', title: 'Your role in this plant is read-only' });
    expect(of(403, 'TENANT_SCOPE_REQUIRED')?.kind).toBe('scope');
    expect(of(403, 'SITE_SCOPE_REQUIRED')?.kind).toBe('scope');
    expect(of(403, 'SEPARATION_OF_DUTIES')?.kind).toBe('duties');
    expect(of(409, 'VERSION_NOT_DRAFT')?.kind).toBe('state');
    const stale = toV2Error(412, { code: 'STALE_REVISION', message: 'current revision 4', correlationId: null, retryable: false }, '"4"', null);
    expect(stale).toBeInstanceOf(StaleRevisionError);
    expect(refusalOf(stale)?.kind).toBe('stale');
    const invalid = toV2Error(422, { code: 'VALIDATION_FAILED', message: 'x', correlationId: null, retryable: false, fieldErrors: [{ field: 'rate', message: 'rate must be a decimal' }] }, null, null);
    expect(refusalOf(invalid)).toMatchObject({ kind: 'validation', fieldErrors: { rate: 'Must be a decimal' } });
    expect(refusalOf(null)).toBeNull();
  });
});

describe('profile and rate forms', () => {
  it('mirrors the API request shape with its field names and sends plant-clock times as UTC', () => {
    const empty = validateProfileForm(emptyProfileForm(), TEHRAN, true);
    expect(Object.keys(empty).sort()).toEqual(['effectiveFrom', 'productId', 'quantityUom', 'rateTimebase', 'unitId']);
    const values = { ...emptyProfileForm(), unitId: 'u', productId: 'p', quantityUom: 't', rateTimebase: 'h' as const, effectiveFrom: '2026-10-10T06:00', effectiveTo: '2026-10-10T05:00' };
    expect(validateProfileForm(values, TEHRAN, true)).toEqual({ effectiveTo: 'The end must be after the start' });
    expect(profileCreateBody({ ...values, effectiveTo: '' }, TEHRAN)).toEqual({
      unitId: 'u', productId: 'p', operatingMode: 'normal', quantityUom: 't', rateTimebase: 'h', capacityModel: 'single_stream',
      effectiveFrom: '2026-10-10T02:30:00.000Z', effectiveTo: null,
    });
    expect(validateProfileForm({ ...values, operatingMode: 'bad mode' }, TEHRAN, true).operatingMode).toMatch(/letters, digits/);
  });

  it('keeps rates and values as decimal strings; currency must be ISO 4217', () => {
    const rate = { rateKind: 'sustained' as const, rate: '120.12345678', timebase: 'h' as const, effectiveFrom: '2026-10-10T06:00', effectiveTo: '' };
    expect(validateRateForm({ ...rate, rate: null }, TEHRAN)).toEqual({ rate: 'Enter the rate' });
    expect(rateCreateBody(rate, TEHRAN)).toEqual({ rateKind: 'sustained', rate: '120.12345678', timebase: 'h', effectiveFrom: '2026-10-10T02:30:00.000Z', effectiveTo: null });
    expect(validateValuationForm({ basis: 'contribution_margin', value: '1', currency: 'usd', effectiveFrom: '2026-10-10T06:00', effectiveTo: '' }, TEHRAN)).toEqual({ currency: 'Use a three-letter currency code, e.g. USD' });
  });

  it('SME V2: a rework yield is a ratio in (0, 1] sent without a currency', () => {
    const yieldForm = { basis: 'rework_yield' as const, value: '0.9', currency: 'usd', effectiveFrom: '2026-10-10T06:00', effectiveTo: '' };
    expect(validateValuationForm(yieldForm, TEHRAN)).toEqual({});
    expect(validateValuationForm({ ...yieldForm, value: '1.2' }, TEHRAN)).toEqual({ value: 'Enter a yield above 0 and at most 1' });
    expect(validateValuationForm({ ...yieldForm, value: '0' }, TEHRAN)).toEqual({ value: 'Enter a yield above 0 and at most 1' });
    expect(valuationCreateBody('p1', yieldForm, TEHRAN)).toEqual({ profileId: 'p1', basis: 'rework_yield', value: '0.9', effectiveFrom: '2026-10-10T02:30:00.000Z', effectiveTo: null });
    expect(valuationCreateBody('p1', { ...yieldForm, basis: 'rework_cost', currency: 'USD' }, TEHRAN)).toMatchObject({ currency: 'USD' });
  });
});

describe('calendar draft (CAL01)', () => {
  it('offers the D03 3 × 8 h shape, validates with API field paths and builds the body', () => {
    const draft = { ...newCalendarDraft(TEHRAN), effectiveFrom: '2026-10-10' };
    expect(validateCalendarDraft(draft)).toEqual({});
    const broken = { ...draft, templates: [{ name: '', startLocal: '6:00', endLocal: '14:00', days: '8' }] };
    expect(validateCalendarDraft(broken)).toEqual({
      'shiftTemplates.0.name': 'Enter a name',
      'shiftTemplates.0.startLocal': 'Use a time like 06:00',
      'shiftTemplates.0.daysOfWeek': 'Use weekdays 1–7 (Monday = 1), separated by commas',
    });
    const withExclusion = { ...draft, templates: [{ ...draft.templates[0], days: '1, 2' }], exclusions: [{ from: '2026-10-12T10:00', to: '2026-10-12T11:00', reason: 'screw change', kind: 'planned_shutdown' as const }] };
    expect(calendarCreateBody(withExclusion, { unitId: 'u1' })).toMatchObject({
      unitId: 'u1',
      timezone: TEHRAN,
      effectiveFrom: '2026-10-10',
      effectiveTo: null,
      shiftTemplates: [{ name: 'A', startLocal: '06:00', endLocal: '14:00', daysOfWeek: [1, 2] }],
      exclusions: [{ from: '2026-10-12T06:30:00.000Z', to: '2026-10-12T07:30:00.000Z', reason: 'screw change', kind: 'planned_shutdown' }],
    });
  });

  it('round-trips a stored version (exclusions on the calendar clock)', () => {
    const stored = {
      timezone: 'Europe/Berlin', operationalDayStart: '06:00', effectiveFrom: '2026-10-01', effectiveTo: null,
      shiftTemplates: [{ name: 'N', startLocal: '22:00', endLocal: '06:00' }], workingIntervals: [], holidays: [{ date: '2026-10-03', name: 'Unity', treatment: 'reduced' }],
      exclusions: [{ from: '2026-10-05T08:00:00.000Z', to: '2026-10-05T09:00:00.000Z', reason: 'r', kind: 'no_demand' }],
    } as unknown as CalendarVersionView;
    const draft = draftOf(stored);
    expect(draft.exclusions[0]).toMatchObject({ from: '2026-10-05T10:00', to: '2026-10-05T11:00' });
    expect(definitionOf(draft).exclusions?.[0]).toMatchObject({ from: '2026-10-05T08:00:00.000Z', to: '2026-10-05T09:00:00.000Z' });
    expect(definitionOf(draft).holidays?.[0].treatment).toBe('reduced');
  });

  it('labels offsets and matches the server warnings to their rows (no client schedule maths)', () => {
    expect(offsetLabel(210)).toBe('+03:30');
    expect(offsetLabel(-300)).toBe('-05:00');
    const map = warningsByRow([{ code: 'dst_repeat', localDate: '2026-10-25', shiftName: 'C' }, { code: 'holiday_reduced', localDate: '2026-10-25', shiftName: null }]);
    const row = { localDate: '2026-10-25', shiftName: 'C' } as Parameters<typeof warningsOf>[1];
    expect(warningsOf(map, row).map((w) => w.code)).toEqual(['dst_repeat', 'holiday_reduced']);
    expect(cycleOf('A, A,-,,B')).toEqual(['A', 'A', null, null, 'B']);
    expect(cycleText(['A', null])).toBe('A,-');
  });
});

describe('plan form (PLAN02 / PLAN03)', () => {
  it('needs a header target (or slice targets) for a quantity plan; no default quantity exists', () => {
    const values = { ...emptyPlanForm(), name: 'P', unitId: 'u', validFrom: '2026-11-01T06:00', validTo: '2026-11-02T06:00', slices: [{ productId: 'p', campaignFrom: '', campaignTo: '', weight: null, target: null }] };
    expect(emptyPlanForm().headerTarget).toBeNull();
    expect(validatePlanForm(values, TEHRAN, true)).toEqual({ headerTarget: 'A quantity plan needs a header target (or a target on every slice)' });
    expect(validatePlanForm({ ...values, basis: 'time' }, TEHRAN, true)).toEqual({});
    expect(planCreateBody({ ...values, headerTarget: '1000' }, TEHRAN)).toEqual({
      name: 'P', unitId: 'u', validFrom: '2026-11-01T02:30:00.000Z', validTo: '2026-11-02T02:30:00.000Z', basis: 'quantity', headerTarget: '1000',
      distribution: 'scheduled_capacity', changeReason: null, manualTargets: null,
      slices: [{ productId: 'p', campaignFrom: null, campaignTo: null, weight: null, target: null, stream: 'sequential' }],
    });
  });

  it('Σ badge compares the server totals with the header as strings; frozen versions are not open', () => {
    expect(sumMatchesHeader([{ target: '1000' }], '1000')).toBe(true);
    expect(sumMatchesHeader([{ target: '999.99999999' }], '1000')).toBe(false);
    expect(sumMatchesHeader([{ target: '1' }, { target: '2' }], '3')).toBeNull();
    expect(sumMatchesHeader([{ target: '630' }], null)).toBeNull();
    expect(isOpenVersion({ approvalState: 'draft' })).toBe(true);
    expect(isOpenVersion({ approvalState: 'approved' })).toBe(false);
    expect(isOpenVersion({ approvalState: 'superseded' })).toBe(false);
  });
});

describe('start from an existing plan (replaces v1 plan templates)', () => {
  it('copies unit, basis, target, distribution and products, never the window or campaign dates', () => {
    const version = {
      unitId: 'u1', basis: 'quantity', headerTarget: '5000', distribution: 'explicit_weights',
      slices: [{ productId: 'p1', weight: '2', target: null, campaignFrom: '2026-11-01T00:00:00.000Z', campaignTo: null }],
    } as unknown as Parameters<typeof copiedPlanValues>[0];
    expect(copiedPlanValues(version)).toEqual({
      unitId: 'u1', basis: 'quantity', headerTarget: '5000', distribution: 'explicit_weights', manualTargets: [],
      slices: [{ productId: 'p1', campaignFrom: '', campaignTo: '', weight: '2', target: null }],
    });
  });
});

describe('server field messages in plain words', () => {
  it('drops the field name and never shows internal field tokens', () => {
    expect(plainFieldMessage('quantityUom', 'quantityUom must be shorter than or equal to 50 characters')).toBe('Must be shorter than or equal to 50 characters');
    expect(plainFieldMessage('slices.0.productId', 'productId must be a UUID')).toBe('Must be a UUID');
    expect(plainFieldMessage('validTo', 'must be after validFrom')).toBe('Is not valid');
  });
});
