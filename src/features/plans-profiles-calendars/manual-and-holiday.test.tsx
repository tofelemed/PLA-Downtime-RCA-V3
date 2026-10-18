import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ManualTargetsEditor } from './plans/manual-targets-editor';
import { emptyPlanForm, planCreateBody, planFormOf, copiedPlanValues, validatePlanForm, type PlanFormValues } from './model/plan-form';
import { newCalendarDraft, validateCalendarDraft, definitionOf } from './model/calendar-draft';
import type { PlanVersionView } from '@/api/v2/types/plans';
const zone = 'Asia/Dubai';
const values = (): PlanFormValues => ({ ...emptyPlanForm(), name: 'Extruder shift', unitId: 'unit', validFrom: '2026-10-17T06:00', validTo: '2026-10-18T06:00', basis: 'manual', slices: [{ productId: 'hdpe', campaignFrom: '', campaignTo: '', weight: null, target: null }], manualTargets: [{ slicePosition: 0, startLocal: '2026-10-17T06:00', target: '224' }] });
describe('manual shift target entry', () => {
  it('converts the plant shift instant to UTC and preserves the exact decimal target', () => {
    expect(validatePlanForm(values(), zone, true)).toEqual({});
    const body = planCreateBody(values(), zone);
    expect(body.manualTargets).toEqual([{ slicePosition: 0, utcStart: '2026-10-17T02:00:00.000Z', target: '224' }]);
    const version = { ...body, manualTargets: body.manualTargets } as unknown as PlanVersionView;
    expect(planFormOf({ name: 'Extruder', scenarioId: null }, version, zone).manualTargets).toEqual(values().manualTargets);
    expect(copiedPlanValues(version).manualTargets).toEqual([{ slicePosition: 0, startLocal: '', target: '224' }]);
  });
  it('requires valid targets and a valid product slice', () => {
    expect(validatePlanForm({ ...values(), manualTargets: [] }, zone, true).manualTargets).toBeTruthy();
    const errors = validatePlanForm({ ...values(), manualTargets: [{ slicePosition: 3, startLocal: '', target: '-1' }] }, zone, true);
    expect(Object.keys(errors)).toHaveLength(3);
  });
  it('lets the user add and remove rows', () => {
    function Editor() { const [rows, setRows] = useState<NonNullable<PlanFormValues['manualTargets']>>([]); return <ManualTargetsEditor rows={rows} slices={values().slices} timezone={zone} errors={{}} onChange={setRows} />; }
    render(<MemoryRouter><Editor /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Add shift target' }));
    expect(screen.getByLabelText('Shift target')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove target' }));
    expect(screen.queryByLabelText('Shift target')).toBeNull();
  });
});
describe('reduced holiday working windows', () => {
  it('requires explicit hours for new calendar edits and sends them unchanged', () => {
    const draft = { ...newCalendarDraft(zone), effectiveFrom: '2026-10-01', holidays: [{ date: '2026-10-17', name: 'Short shift', treatment: 'reduced' as const }] };
    expect(validateCalendarDraft(draft)['holidays.0.workingIntervals']).toBeTruthy();
    const complete = { ...draft, holidays: [{ ...draft.holidays[0], workingIntervals: [{ startLocal: '06:00', endLocal: '10:00' }] }] };
    expect(validateCalendarDraft(complete)).toEqual({});
    expect(definitionOf(complete).holidays[0].workingIntervals).toEqual([{ startLocal: '06:00', endLocal: '10:00' }]);
  });
});
