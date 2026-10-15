import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_FORM, type EventFormValues } from '../model/event-form';
import { ImpactFields } from './impact-fields';

const formOf = (values: Partial<EventFormValues>, setField = vi.fn()) => ({
  values: { ...EMPTY_FORM, ...values },
  errors: {},
  setField,
});

describe('ImpactFields (SME Q5)', () => {
  it('offers the production impact of a stop and asks for the share lost when partial', () => {
    const setField = vi.fn();
    const { rerender } = render(<ImpactFields form={formOf({ physicalType: 'downtime' }, setField)} />);
    const select = screen.getByLabelText('Impact on production');
    expect(screen.queryByLabelText('Output lost (%)')).toBeNull();
    fireEvent.change(select, { target: { value: 'fractional' } });
    expect(setField).toHaveBeenCalledWith('impactMode', 'fractional');
    rerender(<ImpactFields form={formOf({ physicalType: 'downtime', impactMode: 'fractional' }, setField)} />);
    expect(screen.getByLabelText('Output lost (%)')).toBeInTheDocument();
  });

  it('plan 1.10: says when the impact came from a unit impact rule or a standby takeover', () => {
    render(<ImpactFields form={formOf({ physicalType: 'downtime', impactMode: 'none', impactBasis: 'standby_takeover' })} />);
    expect(screen.getByTestId('impact-basis').textContent).toContain('standby took over');
  });

  it('is not shown for events other than downtime', () => {
    const { container } = render(<ImpactFields form={formOf({ physicalType: 'quality_loss' })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
