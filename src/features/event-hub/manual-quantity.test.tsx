import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EMPTY_FORM, toCreateBody, toPatchBody, validateEventForm } from './model/event-form';
import { QualityFields } from './components/quality-fields';
const base = { ...EMPTY_FORM, unitId: 'unit', startLocal: '2026-10-17T06:00', endLocal: '2026-10-17T07:00', quantityUom: 't' };
describe('manual output and slowdown evidence', () => {
  it('shows output quantity and unit without a quality disposition', () => {
    render(<QualityFields form={{ values: { ...base, physicalType: 'production_output' }, errors: {}, setField: vi.fn() }} />);
    expect(screen.getByLabelText('Quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit')).toBeInTheDocument();
    expect(screen.queryByLabelText('Disposition')).toBeNull();
  });
  it('sends production quantities and distinct measured/fractional slowdown evidence', () => {
    expect(toCreateBody({ ...base, physicalType: 'production_output', quantity: '200' }, 'Asia/Dubai')).toMatchObject({ quantity: '200', quantityUom: 't' });
    expect(toCreateBody({ ...base, physicalType: 'slowdown', quantity: '5' }, 'Asia/Dubai')).toMatchObject({ impactMode: 'measured', quantity: '5' });
    const derate = { ...base, physicalType: 'slowdown', impactPercent: '25' };
    expect(toCreateBody(derate, 'Asia/Dubai')).toMatchObject({ impactMode: 'fractional', impactFraction: '0.25' });
    expect(toPatchBody(derate, { ...derate, impactPercent: '', quantity: '4' }, 'Asia/Dubai')).toMatchObject({ impactMode: 'measured', impactFraction: null, quantity: '4' });
    expect(validateEventForm({ ...derate, quantity: '5' }, 'create', 'Asia/Dubai').impactPercent).toBeTruthy();
    expect(validateEventForm({ ...base, physicalType: 'production_output', quantity: '-5' }, 'create', 'Asia/Dubai').quantity).toBeTruthy();
  });
});
