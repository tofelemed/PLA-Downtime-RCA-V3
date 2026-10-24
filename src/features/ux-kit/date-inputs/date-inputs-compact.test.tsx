import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarPopover } from './calendar-popover';
import { DateInput } from './date-input';
import { DateRangeInput } from './date-range-input';
import { DateTimeInput } from './date-time-input';
import type { InstantRange } from './date-input-model';

const RANGE: InstantRange = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-13T00:00:00.000Z' };
const calendarButton = (label: string) => screen.getByRole('button', { name: `Open calendar for ${label}` });

describe('CalendarPopover compact option', () => {
  it('is a 40 px button by default', () => {
    render(<CalendarPopover label="From" value="2026-10-15" onSelect={vi.fn()} calendar="gregorian" digits="latin" weekStart="saturday" />);
    expect(calendarButton('From')).toHaveClass('h-10', 'w-10');
    expect(calendarButton('From')).not.toHaveClass('h-9');
  });

  it('is a 36 px button with `compact`', () => {
    render(<CalendarPopover label="From" value="2026-10-15" onSelect={vi.fn()} calendar="gregorian" digits="latin" weekStart="saturday" compact />);
    expect(calendarButton('From')).toHaveClass('h-9', 'w-9');
    expect(calendarButton('From')).not.toHaveClass('h-10');
  });
});

describe('DateInput compact option', () => {
  it('keeps the default field height without `compact`', () => {
    render(<DateInput label="Day" value="2026-10-12" onChange={vi.fn()} calendarPicker={{ weekStart: 'saturday' }} />);
    expect(screen.getByLabelText('Day')).not.toHaveClass('h-9');
    expect(calendarButton('Day')).toHaveClass('h-10');
  });

  it('makes the Gregorian field and its calendar button h-9 with `compact`', () => {
    render(<DateInput label="Day" value="2026-10-12" onChange={vi.fn()} calendarPicker={{ weekStart: 'saturday' }} compact />);
    expect(screen.getByLabelText('Day')).toHaveClass('h-9');
    expect(calendarButton('Day')).toHaveClass('h-9');
  });

  it('makes the Solar Hijri field h-9 with `compact`', () => {
    render(<DateInput label="Day" value="2026-10-12" onChange={vi.fn()} calendar="persian" compact />);
    expect(screen.getByLabelText('Day')).toHaveClass('h-9');
  });
});

describe('DateRangeInput toolbar option', () => {
  it('default: a visible legend, "To (inclusive)" and no compact fields', () => {
    render(<DateRangeInput label="Period" value={RANGE} timeZone="UTC" onChange={vi.fn()} />);
    const fieldset = screen.getByRole('group', { name: 'Period' });
    expect(fieldset).not.toHaveClass('contents');
    expect(fieldset.querySelector('legend')).not.toHaveClass('sr-only');
    expect(screen.getByLabelText('To (inclusive)')).not.toHaveClass('h-9');
  });

  it('`toolbar`: the fieldset and its row take no box, the legend is screen-reader only and the fields are h-9', () => {
    render(<DateRangeInput label="Period" value={RANGE} timeZone="UTC" toLabel="To" calendarPicker weekStart="saturday" toolbar onChange={vi.fn()} />);
    const fieldset = screen.getByRole('group', { name: 'Period' });
    expect(fieldset).toHaveClass('contents');
    expect(fieldset.firstElementChild?.nextElementSibling).toHaveClass('contents');
    expect(fieldset.querySelector('legend')).toHaveClass('sr-only');
    expect(screen.getByLabelText('From')).toHaveClass('h-9');
    expect(screen.getByLabelText('To')).toHaveClass('h-9');
    expect(calendarButton('From')).toHaveClass('h-9');
    expect(calendarButton('To')).toHaveClass('h-9');
  });
});

describe('DateTimeInput compact option', () => {
  it('keeps the default heights without `compact` (other pages unchanged)', () => {
    render(<DateTimeInput label="Observed at" value="2026-10-12T08:30:00.000Z" timeZone="UTC" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Observed at date')).not.toHaveClass('h-9');
    expect(screen.getByLabelText('Observed at time')).not.toHaveClass('h-9');
  });

  it('makes the date and time fields h-9 with `compact`', () => {
    render(<DateTimeInput label="Observed at" value="2026-10-12T08:30:00.000Z" timeZone="UTC" onChange={vi.fn()} compact />);
    expect(screen.getByLabelText('Observed at date')).toHaveClass('h-9');
    expect(screen.getByLabelText('Observed at time')).toHaveClass('h-9', 'w-[8rem]');
  });
});
