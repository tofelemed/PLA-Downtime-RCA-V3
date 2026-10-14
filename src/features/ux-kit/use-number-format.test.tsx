import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalendarPreferenceContext, type DigitSystem } from '@/lib/dates';
import { useNumberFormat } from './use-number-format';

const formatIn = (digits: DigitSystem) =>
  renderHook(() => useNumberFormat(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <CalendarPreferenceContext.Provider value={{ calendar: 'gregorian', digits }}>{children}</CalendarPreferenceContext.Provider>
    ),
  }).result.current;

describe('useNumberFormat', () => {
  it('formats percentages, ticks and counts in Latin digits by default', () => {
    const format = formatIn('latin');
    expect(format.percent(87.5, 1)).toBe('87.5 %');
    expect(format.percent(-12)).toBe('-12 %');
    expect(format.axis(2500)).toBe('2,500');
    expect(format.axis(0.25)).toBe('0.25');
    expect(format.number(1234)).toBe('1,234');
  });

  it('uses Persian digits and separators; "%" and the minus sign stay as they are', () => {
    const format = formatIn('persian');
    expect(format.percent(87.5, 1)).toBe('۸۷٫۵ %');
    expect(format.percent(-12)).toBe('-۱۲ %');
    expect(format.axis(2500)).toBe('۲٬۵۰۰');
    expect(format.decimal('-1234.5')).toBe('-۱٬۲۳۴٫۵۰');
    expect(format.text('87.5 %')).toBe('۸۷٫۵ %');
  });

  it('shows "—" for absent values', () => {
    const format = formatIn('persian');
    expect(format.percent(null)).toBe('—');
    expect(format.number(undefined)).toBe('—');
    expect(format.decimal(null)).toBe('—');
  });
});
