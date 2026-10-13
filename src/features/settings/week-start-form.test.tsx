import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WeekStartForm } from './week-start-form';

describe('WeekStartForm (DT-10)', () => {
  it('saves Saturday for an Iranian plant; nothing to save until the choice changes', () => {
    const onSave = vi.fn();
    render(<WeekStartForm saved="monday" canEdit pending={false} error={null} onSave={onSave} />);
    expect(screen.getByTestId('save-week-start')).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Saturday/ }));
    fireEvent.click(screen.getByTestId('save-week-start'));
    expect(onSave).toHaveBeenCalledWith('saturday');
  });

  it('read-only users see the setting and why they cannot change it', () => {
    render(<WeekStartForm saved="saturday" canEdit={false} pending={false} error={null} onSave={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /Saturday/ })).toBeChecked();
    expect(screen.queryByTestId('save-week-start')).toBeNull();
    expect(screen.getByText(/Only a plant administrator/)).toBeInTheDocument();
  });
});
