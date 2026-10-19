import { describe, expect, it } from 'vitest';
import {
  INVALID_DATE_MESSAGE,
  INVALID_GREGORIAN_DATE_MESSAGE,
  RANGE_ORDER_MESSAGE,
  boundsError,
  dateRangeError,
  dateToText,
  datesFromRange,
  instantRangeError,
  joinInstant,
  parseDateText,
  rangeFromDates,
  splitInstant,
} from './date-input-model';

describe('date-input-model', () => {
  it('parses Jalali text with Latin or Persian digits and either separator', () => {
    expect(parseDateText('1405/07/20', 'persian')).toEqual({ value: '2026-10-12', error: null });
    expect(parseDateText(' ۱۴۰۵-۷-۲۰ ', 'persian')).toEqual({ value: '2026-10-12', error: null });
    expect(parseDateText('1403/12/30', 'persian').value).toBe('2025-03-20');
    expect(parseDateText('', 'persian')).toEqual({ value: '', error: null });
  });

  it('rejects unreadable or non-existent dates', () => {
    for (const text of ['1404/12/30', '1405/13/01', '1405/07/31', '14050720', 'abc']) {
      expect(parseDateText(text, 'persian')).toEqual({ value: '', error: INVALID_DATE_MESSAGE });
    }
    expect(parseDateText('2026-02-30', 'gregorian').error).toBe(INVALID_GREGORIAN_DATE_MESSAGE);
    expect(parseDateText('17/10/2026', 'gregorian').error).toBe('Use YYYY-MM-DD, e.g. 2026-10-17');
    expect(parseDateText('2026/2/3', 'gregorian')).toEqual({ value: '2026-02-03', error: null });
  });

  it('formats ISO dates for the field and checks bounds', () => {
    expect(dateToText('2026-10-12', 'persian')).toBe('1405/07/20');
    expect(dateToText('2026-10-12', 'gregorian')).toBe('2026-10-12');
    expect(dateToText('', 'persian')).toBe('');
    expect(boundsError('2026-10-12', 'persian', '2026-10-13')).toBe('Enter a date on or after 1405/07/21');
    expect(boundsError('2026-10-12', 'gregorian', undefined, '2026-10-11')).toBe('Enter a date on or before 2026-10-11');
    expect(boundsError('2026-10-12', 'gregorian', '2026-10-12', '2026-10-12')).toBeNull();
  });

  it('splits and joins instants on the plant clock (DST zone)', () => {
    expect(splitInstant('2026-03-08T07:30:00.000Z', 'America/New_York')).toEqual({ date: '2026-03-08', time: '03:30' });
    expect(joinInstant({ date: '2026-03-08', time: '03:30' }, 'America/New_York')).toBe('2026-03-08T07:30:00.000Z');
    expect(joinInstant({ date: '2026-03-08', time: '' }, 'America/New_York')).toBe('2026-03-08T05:00:00.000Z');
    expect(joinInstant({ date: '', time: '10:00' }, 'UTC')).toBeNull();
    expect(splitInstant(null, 'UTC')).toEqual({ date: '', time: '' });
  });

  it('turns inclusive dates into a half-open range and back', () => {
    const range = rangeFromDates({ start: '2026-10-01', end: '2026-10-12' }, 'Asia/Tehran');
    expect(range).toEqual({ from: '2026-09-30T20:30:00.000Z', to: '2026-10-12T20:30:00.000Z' });
    expect(datesFromRange(range, 'Asia/Tehran')).toEqual({ start: '2026-10-01', end: '2026-10-12' });
    expect(rangeFromDates({ start: '', end: '2026-10-12' }, 'UTC')).toEqual({ from: null, to: '2026-10-13T00:00:00.000Z' });
    expect(datesFromRange({ from: null, to: null }, 'UTC')).toEqual({ start: '', end: '' });
  });

  it('flags reversed ranges', () => {
    expect(dateRangeError({ start: '2026-10-12', end: '2026-10-11' })).toBe(RANGE_ORDER_MESSAGE);
    expect(dateRangeError({ start: '2026-10-12', end: '2026-10-12' })).toBeNull();
    expect(instantRangeError({ from: '2026-10-12T06:00:00Z', to: '2026-10-12T06:00:00Z' })).not.toBeNull();
    expect(instantRangeError({ from: '2026-10-12T06:00:00Z', to: null })).toBeNull();
  });
});
