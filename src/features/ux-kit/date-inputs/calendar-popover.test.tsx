import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CalendarPopover, type CalendarPopoverProps } from './calendar-popover';

const setup = (props: Partial<CalendarPopoverProps> = {}) => {
  const onSelect = vi.fn();
  render(<CalendarPopover label="From" value="2026-10-15" onSelect={onSelect} calendar="gregorian" digits="latin" weekStart="saturday" {...props} />);
  const trigger = screen.getByRole('button', { name: 'Open calendar for From' });
  fireEvent.click(trigger);
  return { onSelect, trigger };
};

const day = (iso: string) => document.querySelector(`[data-date="${iso}"]`) as HTMLElement;

describe('CalendarPopover', () => {
  it('shows the Gregorian month of the value, Saturday first, with the value selected and focused', () => {
    setup();
    const grid = screen.getByRole('grid', { name: 'October 2026' });
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(grid).toBeInTheDocument();
    expect(day('2026-10-15').closest('td')).toHaveAttribute('aria-selected', 'true');
    expect(day('2026-10-15')).toHaveFocus();
  });

  it('shows the Solar Hijri month with the plant digits', () => {
    setup({ calendar: 'persian', digits: 'persian' });
    expect(screen.getByRole('grid', { name: 'Mehr ۱۴۰۵' })).toBeInTheDocument();
    // 15 Oct 2026 = 23 Mehr 1405
    expect(day('2026-10-15')).toHaveTextContent('۲۳');
    expect(day('2026-10-15')).toHaveAccessibleName('۱۴۰۵/۰۷/۲۳');
    expect(day('2026-09-23')).toHaveTextContent('۱');
  });

  it('selecting a day writes the date, closes and returns focus to the button', async () => {
    const { onSelect, trigger } = setup();
    fireEvent.click(day('2026-10-20'));
    expect(onSelect).toHaveBeenCalledWith('2026-10-20');
    expect(screen.queryByRole('grid')).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('arrow keys move days (across months), Enter selects', () => {
    const { onSelect } = setup();
    fireEvent.keyDown(day('2026-10-15'), { key: 'ArrowRight' });
    expect(day('2026-10-16')).toHaveFocus();
    fireEvent.keyDown(day('2026-10-16'), { key: 'ArrowDown' });
    expect(day('2026-10-23')).toHaveFocus();
    fireEvent.keyDown(day('2026-10-23'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('2026-10-23');
  });

  it('moving before the first day shows the previous month', () => {
    setup({ value: '2026-10-01' });
    fireEvent.keyDown(day('2026-10-01'), { key: 'ArrowLeft' });
    expect(screen.getByRole('grid', { name: 'September 2026' })).toBeInTheDocument();
    expect(day('2026-09-30')).toHaveFocus();
  });

  it('the month buttons page months', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('grid', { name: 'September 2026' })).toBeInTheDocument();
  });

  it('Esc closes without choosing and returns focus to the button', async () => {
    const { onSelect, trigger } = setup();
    fireEvent.keyDown(day('2026-10-15'), { key: 'Escape' });
    expect(screen.queryByRole('grid')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('without a value it opens on the fallback date', () => {
    setup({ value: '', fallbackDate: '2026-03-05' });
    expect(screen.getByRole('grid', { name: 'March 2026' })).toBeInTheDocument();
    expect(day('2026-03-05')).toHaveFocus();
  });
});
