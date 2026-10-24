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

  it('read-only users see the setting as text (no disabled radios) and why they cannot change it', () => {
    render(<WeekStartForm saved="saturday" canEdit={false} pending={false} error={null} onSave={vi.fn()} />);
    expect(screen.getByTestId('week-start-value')).toHaveTextContent('First day of the week: Saturday');
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByTestId('save-week-start')).toBeNull();
    expect(screen.getByText(/Only a plant administrator/)).toBeInTheDocument();
  });

  it('offers all seven days (owner 21 Oct 2026) and saves the one chosen', () => {
    const onSave = vi.fn();
    render(<WeekStartForm saved="saturday" canEdit pending={false} error={null} onSave={onSave} />);
    expect(screen.getAllByRole('radio')).toHaveLength(7);
    fireEvent.click(screen.getByRole('radio', { name: /Sunday/ }));
    fireEvent.click(screen.getByTestId('save-week-start'));
    expect(onSave).toHaveBeenCalledWith('sunday');
  });
});
