import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EMPTY_FORM } from '../model/event-form';
import { FailureFields } from './failure-fields';

describe('FailureFields (SME D8 / D11)', () => {
  it('downtime only; severity says which choices count in MTBF', () => {
    const setField = vi.fn();
    const { rerender } = render(<FailureFields form={{ values: { ...EMPTY_FORM, physicalType: 'slowdown' }, errors: {}, setField }} />);
    expect(screen.queryByTestId('failure-fields')).toBeNull();
    rerender(<FailureFields form={{ values: EMPTY_FORM, errors: {}, setField }} />);
    expect(screen.getByRole('option', { name: /Incipient.*not a failure/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'critical' } });
    expect(setField).toHaveBeenCalledWith('failureSeverity', 'critical');
    fireEvent.change(screen.getByLabelText('Maintainable item'), { target: { value: 'Seal' } });
    expect(setField).toHaveBeenCalledWith('maintainableItem', 'Seal');
  });
});
