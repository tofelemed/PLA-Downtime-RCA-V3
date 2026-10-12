import { describe, expect, it } from 'vitest';
import { formatDuration as uxFormatDuration } from '@/features/ux-kit/format/duration';
import { toDigits, toLatinDigits } from './digits';
import {
  formatDate,
  formatDateTime,
  formatMonth,
  formatOperationalDate,
  formatRange,
  formatTime,
} from './format-date';
import { formatDuration } from './format-duration';

/** The pre-delegation `formatPlantTime` logic, kept here as the Gregorian reference. */
function referencePlantTime(iso: string, timezone: string, withDate: boolean): string {
  let zone = timezone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    zone = 'UTC';
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const m = /([+-])(\d{1,2})(?::?(\d{2}))?/.exec(part('timeZoneName'));
  const offset = m ? `${m[1]}${m[2].padStart(2, '0')}:${m[3] ?? '00'}` : '+00:00';
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const time = `${part('hour')}:${part('minute')}`;
  return `${withDate ? `${date} ${time}` : time} (${offset} ${zone})`;
}

const ZONES = ['Asia/Tehran', 'Asia/Dubai', 'UTC', 'America/New_York', 'Not/AZone'];
const INSTANTS = [
  '2026-10-09T02:30:00Z',
  '2026-03-08T06:59:00Z',
  '2026-03-08T07:00:00Z',
  '2026-11-01T05:30:00Z',
  '2026-11-01T06:30:00Z',
  '2021-03-21T20:30:00Z',
  '2026-12-31T23:59:59.999Z',
  '2000-01-01T00:00:00Z',
];
const TEHRAN = { timeZone: 'Asia/Tehran' } as const;
const TEHRAN_FA = { timeZone: 'Asia/Tehran', calendar: 'persian' } as const;

describe('format-date (Gregorian)', () => {
  it('matches the previous formatPlantTime output byte for byte', () => {
    for (const zone of ZONES) {
      for (const iso of INSTANTS) {
        expect(formatDateTime(iso, { timeZone: zone, withZone: true })).toBe(referencePlantTime(iso, zone, true));
        expect(formatTime(iso, { timeZone: zone, withZone: true })).toBe(referencePlantTime(iso, zone, false));
      }
    }
  });

  it('formats date, time and date-time on the plant clock', () => {
    const iso = '2026-10-12T06:30:00Z';
    expect(formatDate(iso, TEHRAN)).toBe('2026-10-12');
    expect(formatTime(iso, TEHRAN)).toBe('10:00');
    expect(formatDateTime(iso, { timeZone: 'UTC' })).toBe('2026-10-12 06:30');
    expect(formatDateTime('2026-10-12T22:00:00Z', TEHRAN)).toBe('2026-10-13 01:30');
    expect(formatMonth(iso, TEHRAN)).toBe('Oct 2026');
  });

  it('renders "—" for invalid or absent input', () => {
    for (const value of [null, undefined, '', 'nope']) {
      expect(formatDate(value, TEHRAN)).toBe('—');
      expect(formatTime(value, TEHRAN)).toBe('—');
      expect(formatDateTime(value, TEHRAN)).toBe('—');
      expect(formatMonth(value, TEHRAN)).toBe('—');
      expect(formatRange(value, '2026-10-12T06:00:00Z', TEHRAN)).toBe('—');
    }
    expect(formatRange('2026-10-12T06:00:00Z', 'nope', TEHRAN)).toBe('—');
  });
});

describe('format-date (Persian calendar)', () => {
  it('shows the Jalali date of the plant day', () => {
    const iso = '2026-10-12T06:30:00Z';
    expect(formatDate(iso, TEHRAN_FA)).toBe('1405/07/20');
    expect(formatTime(iso, TEHRAN_FA)).toBe('10:00');
    expect(formatDateTime(iso, TEHRAN_FA)).toBe('1405/07/20 10:00');
    expect(formatDateTime(iso, { ...TEHRAN_FA, withZone: true })).toBe('1405/07/20 10:00 (+03:30 Asia/Tehran)');
    expect(formatMonth(iso, TEHRAN_FA)).toBe('Mehr 1405');
    expect(formatDate('2024-03-19T20:30:00Z', TEHRAN_FA)).toBe('1403/01/01');
  });

  it('writes Persian digits when asked', () => {
    const opts = { ...TEHRAN_FA, digits: 'persian' } as const;
    expect(formatDateTime('2026-10-12T06:30:00Z', opts)).toBe('۱۴۰۵/۰۷/۲۰ ۱۰:۰۰');
    expect(formatDate('2026-10-12T06:30:00Z', { timeZone: 'UTC', digits: 'persian' })).toBe('۲۰۲۶-۱۰-۱۲');
    expect(toDigits('a1b2', 'latin')).toBe('a1b2');
    expect(toLatinDigits('۱۴۰۵/٠٧/20')).toBe('1405/07/20');
  });
});

describe('formatRange', () => {
  it('collapses a same-day range and spells out multi-day and open ranges', () => {
    const utc = { timeZone: 'UTC' };
    expect(formatRange('2026-10-12T06:00:00Z', '2026-10-12T14:00:00Z', utc)).toBe('2026-10-12 06:00–14:00');
    expect(formatRange('2026-10-12T06:00:00Z', '2026-10-13T06:00:00Z', utc)).toBe('2026-10-12 06:00 – 2026-10-13 06:00');
    expect(formatRange('2026-10-12T06:00:00Z', null, utc)).toBe('2026-10-12 06:00 – ongoing');
    expect(formatRange('2026-10-12T02:30:00Z', '2026-10-12T10:30:00Z', TEHRAN_FA)).toBe('1405/07/20 06:00–14:00');
  });
});

describe('formatOperationalDate', () => {
  it('keeps the calendar date without any zone shift', () => {
    expect(formatOperationalDate('2026-10-12')).toBe('2026-10-12');
    expect(formatOperationalDate('2026-10-12', { calendar: 'persian' })).toBe('1405/07/20');
    expect(formatOperationalDate('2025-03-20', { calendar: 'persian', digits: 'persian' })).toBe('۱۴۰۳/۱۲/۳۰');
    expect(formatOperationalDate('2026-02-30')).toBe('—');
    expect(formatOperationalDate(null)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('matches the ux-kit duration formatter for Latin digits', () => {
    const values = [0, 0.4, 45, 59.6, 60, 89, 90, 3599, 3600, 5400, 7200, 86_399, 360_000, '5400.000', null, -1, 'x', ''];
    for (const value of values) {
      for (const style of ['long', 'compact', 'clock'] as const) {
        expect(formatDuration(value, { style })).toBe(uxFormatDuration(value, style));
      }
    }
    expect(formatDuration(5400, { style: 'clock', digits: 'persian' })).toBe('۱:۳۰');
  });
});
