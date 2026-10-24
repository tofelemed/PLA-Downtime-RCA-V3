import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CalendarPreferenceContext } from '@/lib/dates';
import { DateInput } from './date-input';
import { DateRangeInput } from './date-range-input';
import { DateTimeInput } from './date-time-input';
import type { InstantRange } from './date-input-model';

function ControlledDate({ initial, onChange }: { initial: string; onChange: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DateInput
      label="Operational date"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const persian = { calendar: 'persian', digits: 'latin' } as const;

describe('DateInput', () => {
  it('uses the native date input for Gregorian and emits ISO', () => {
    const onChange = vi.fn();
    render(<DateInput label="Day" value="2026-10-12" onChange={onChange} />);
    const input = screen.getByLabelText('Day');
    expect(input).toHaveAttribute('type', 'date');
    fireEvent.change(input, { target: { value: '2026-10-13' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-10-13');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('shows Jalali text from the preference and emits ISO on Enter and blur', async () => {
    const onChange = vi.fn();
    render(
      <CalendarPreferenceContext.Provider value={persian}>
        <ControlledDate initial="2026-10-12" onChange={onChange} />
      </CalendarPreferenceContext.Provider>,
    );
    const input = screen.getByLabelText('Operational date');
    expect(input).toHaveValue('1405/07/20');
    expect(screen.getByText('Gregorian 2026-10-12')).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, '۱۴۰۵/۰۷/۲۱{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-13');
    expect(input).toHaveValue('1405/07/21');
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('keeps invalid text visible with an accessible error', async () => {
    const onChange = vi.fn();
    render(<DateInput label="Day" calendar="persian" value="" onChange={onChange} />);
    const input = screen.getByLabelText('Day');
    await userEvent.type(input, '1404/12/30{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('1404/12/30');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const error = screen.getByText('Enter a valid date (YYYY/MM/DD)');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
  });

  it('re-syncs its text when the value changes from outside', () => {
    const { rerender } = render(<DateInput label="Day" calendar="persian" value="2026-10-12" onChange={vi.fn()} />);
    rerender(<DateInput label="Day" calendar="persian" value="2025-03-21" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Day')).toHaveValue('1404/01/01');
  });
});

describe('DateTimeInput', () => {
  it('converts the plant wall clock to UTC across DST', () => {
    const onChange = vi.fn();
    render(<DateTimeInput label="Start" value="2026-03-08T05:00:00.000Z" timeZone="America/New_York" onChange={onChange} />);
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-03-08');
    expect(screen.getByLabelText('Start time')).toHaveValue('00:00');
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '03:30' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-03-08T07:30:00.000Z');
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('accepts a Jalali date in Tehran', async () => {
    const onChange = vi.fn();
    render(<DateTimeInput label="Start" value={null} timeZone="Asia/Tehran" calendar="persian" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Start date'), '1405/07/20{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-11T20:30:00.000Z');
  });
});

describe('DateRangeInput', () => {
  it('emits a half-open range in the plant zone and rejects a reversed one', () => {
    const onChange = vi.fn();
    const value: InstantRange = { from: '2026-09-30T20:30:00.000Z', to: '2026-10-12T20:30:00.000Z' };
    render(<DateRangeInput label="Period" value={value} timeZone="Asia/Tehran" onChange={onChange} />);
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('To (inclusive)')).toHaveValue('2026-10-12');
    fireEvent.change(screen.getByLabelText('To (inclusive)'), { target: { value: '2026-10-13' } });
    expect(onChange).toHaveBeenLastCalledWith({ from: value.from, to: '2026-10-13T20:30:00.000Z' });
    onChange.mockClear();
    fireEvent.change(screen.getByLabelText('To (inclusive)'), { target: { value: '2026-09-01' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('The end date must be on or after the start date')).toBeInTheDocument();
    expect(screen.getByLabelText('To (inclusive)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps "To (inclusive)" and no calendar button unless the page opts in', () => {
    render(<DateRangeInput label="Period" value={{ from: null, to: null }} timeZone="UTC" onChange={vi.fn()} />);
    expect(screen.getByLabelText('To (inclusive)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open calendar/ })).toBeNull();
  });

  it('opt-in: plain "To" label and a calendar button per field that writes the date', () => {
    const onChange = vi.fn();
    const value: InstantRange = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-13T00:00:00.000Z' };
    render(<DateRangeInput label="Period" value={value} timeZone="UTC" toLabel="To" calendarPicker weekStart="saturday" textEntry onChange={onChange} />);
    expect(screen.getByLabelText('To')).toHaveValue('2026-10-12');
    expect(screen.queryByLabelText('To (inclusive)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open calendar for To' }));
    fireEvent.click(document.querySelector('[data-date="2026-10-20"]') as HTMLElement);
    expect(onChange).toHaveBeenLastCalledWith({ from: value.from, to: '2026-10-21T00:00:00.000Z' });
    expect(screen.getByRole('button', { name: 'Open calendar for From' })).toBeInTheDocument();
  });

  it('works with Jalali entry', async () => {
    const onChange = vi.fn();
    render(
      <DateRangeInput label="Period" value={{ from: null, to: null }} timeZone="UTC" calendar="persian" onChange={onChange} />,
    );
    await userEvent.type(screen.getByLabelText('From'), '1405/07/01{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-09-23T00:00:00.000Z', to: null });
  });

  it('datetime mode emits instants and rejects an end before the start', () => {
    const onChange = vi.fn();
    const value: InstantRange = { from: '2026-10-12T06:00:00.000Z', to: null };
    render(<DateRangeInput label="Window" mode="datetime" value={value} timeZone="UTC" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-11' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('The end must be after the start')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-13' } });
    expect(onChange).toHaveBeenLastCalledWith({ from: value.from, to: '2026-10-13T00:00:00.000Z' });
  });
});
