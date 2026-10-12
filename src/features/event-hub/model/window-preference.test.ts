import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEventFilters } from './event-url';
import { DEFAULT_WINDOW_PRESET, readWindowPreference, rememberWindow } from './window-preference';

const NOW = Date.parse('2026-10-12T10:00:30.000Z');

describe('Event Hub window preference (per user and plant, localStorage)', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to the last 7 days', () => {
    expect(DEFAULT_WINDOW_PRESET.label).toBe('Last 7 days');
    expect(readWindowPreference('user-1', 'plant-a')).toBe(DEFAULT_WINDOW_PRESET);
    expect(readWindowPreference(null, 'plant-a')).toBe(DEFAULT_WINDOW_PRESET);
  });

  it('remembers a preset for that user in that plant only', () => {
    rememberWindow('user-1', 'plant-a', 'Last 24 h');
    expect(readWindowPreference('user-1', 'plant-a').label).toBe('Last 24 h');
    expect(readWindowPreference('user-1', 'plant-b')).toBe(DEFAULT_WINDOW_PRESET);
    expect(readWindowPreference('user-2', 'plant-a')).toBe(DEFAULT_WINDOW_PRESET);
    const filters = parseEventFilters(new URLSearchParams(), NOW, readWindowPreference('user-1', 'plant-a'));
    expect(filters.windowLabel).toBe('Last 24 h');
    expect(filters.from).toBe('2026-10-11T10:01:00.000Z');
  });

  it('ignores shift and custom windows and unknown stored values', () => {
    rememberWindow('user-1', 'plant-a', '12/10/2026 Morning');
    expect(window.localStorage.length).toBe(0);
    window.localStorage.setItem('proact.eventHub.window.user-1.plant-a', '999');
    expect(readWindowPreference('user-1', 'plant-a')).toBe(DEFAULT_WINDOW_PRESET);
  });

  it('falls back to the default when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => rememberWindow('user-1', 'plant-a', 'Last 8 h')).not.toThrow();
    expect(readWindowPreference('user-1', 'plant-a')).toBe(DEFAULT_WINDOW_PRESET);
  });
});
