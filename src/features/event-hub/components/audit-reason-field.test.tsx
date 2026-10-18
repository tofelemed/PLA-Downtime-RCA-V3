import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuditReasonField } from './audit-reason-field';

describe('AuditReasonField (H-5)', () => {
  it('is a required "Why" with the audit helper linked to the textarea', () => {
    const onChange = vi.fn();
    render(<AuditReasonField id="close-reason" value="" onChange={onChange} maxLength={1000} />);
    const field = screen.getByRole('textbox', { name: /Why \(kept in the history\)/ });
    expect(field).toHaveAttribute('aria-required', 'true');
    expect(field).toHaveAccessibleDescription('A reason is required for the audit history.');
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.change(field, { target: { value: 'motor reset' } });
    expect(onChange).toHaveBeenCalledWith('motor reset');
  });
});
