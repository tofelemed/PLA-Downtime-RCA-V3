import { describe, expect, it } from 'vitest';
import { windowRangeText } from './window-range';

describe('window text on the plant calendar (UX audit D-13)', () => {
  const range = { from: '2026-10-10T20:30:00.000Z', to: '2026-10-17T20:30:00.000Z' };

  it('shows inclusive plant days in ISO form, never the browser locale', () => {
    expect(windowRangeText(range, 'Last 7 days', 'Asia/Tehran', { calendar: 'gregorian', digits: 'latin' })).toBe('Last 7 days · 2026-10-11 – 2026-10-17');
  });

  it('follows the Persian calendar preference', () => {
    expect(windowRangeText(range, 'Chosen dates', 'Asia/Tehran', { calendar: 'persian', digits: 'latin' })).toBe('Chosen dates · 1405/07/19 – 1405/07/25');
  });
});
