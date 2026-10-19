import { describe, expect, it } from 'vitest';
import type { ProductionEventView } from '@/api/v2/types/events';
import { windowRangeText } from '../hooks/use-window-range-text';
import { parseDurationInput } from './duration-input';
import { editTitleOf } from './edit-title';
import { shownWindow, toEventQuery } from './event-filters';
import { EMPTY_FORM, formValuesOf, toCreateBody, toPatchBody, validateEventForm } from './event-form';
import { hasWindowParams, parseEventFilters, toEventSearchParams } from './event-url';
import { relativeWindowOf } from './relative-window';

const NOW = Date.parse('2026-10-18T06:15:20.000Z');
const LATER = NOW + 5 * 60_000;
const UTC = 'UTC';

describe('A-5 rolling windows in the Event Hub URL', () => {
  it('keeps "Last 24 h" relative: only window=24h in the URL, bounds resolved from now', () => {
    const filters = parseEventFilters(new URLSearchParams('window=24h&units=u1'), NOW);
    expect(filters).toMatchObject({ relativeWindow: '24h', windowLabel: 'Last 24 h', unitIds: ['u1'] });
    expect(filters.to).toBe('2026-10-18T07:16:00.000Z');
    expect(filters.from).toBe('2026-10-17T06:16:00.000Z');
    const params = toEventSearchParams(filters);
    expect(params.get('window')).toBe('24h');
    expect(params.has('from')).toBe(false);
    expect(params.has('to')).toBe(false);
  });

  it('re-resolves the same URL later, so a hub left open moves on with time', () => {
    const params = new URLSearchParams('window=24h');
    const first = parseEventFilters(params, NOW);
    const later = parseEventFilters(params, LATER);
    expect(Date.parse(later.from ?? '') - Date.parse(first.from ?? '')).toBe(5 * 60_000);
    expect(toEventQuery(later).to).not.toBe(toEventQuery(first).to);
  });

  it('a missing window is the remembered preset, kept relative', () => {
    const filters = parseEventFilters(new URLSearchParams(), NOW);
    expect(filters.relativeWindow).toBe('7d');
    expect(toEventSearchParams(filters).toString()).toBe('window=7d');
    expect(hasWindowParams(new URLSearchParams())).toBe(false);
    expect(hasWindowParams(new URLSearchParams('window=8h'))).toBe(true);
  });

  it('old links with from / to (and a preset label) stay absolute', () => {
    const url = 'from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-02T00%3A00%3A00.000Z&window=Last+24+h';
    const filters = parseEventFilters(new URLSearchParams(url), NOW);
    expect(filters).toMatchObject({ relativeWindow: null, from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z', windowLabel: 'Last 24 h' });
    expect(toEventSearchParams(filters).get('from')).toBe('2026-10-01T00:00:00.000Z');
    expect(relativeWindowOf('Last 7 days')?.key).toBe('7d');
    expect(relativeWindowOf('Shift A')).toBeNull();
  });

  it('shows the resolved range next to the label, ending now (the look-ahead is internal)', () => {
    const shown = shownWindow(parseEventFilters(new URLSearchParams('window=24h'), NOW));
    expect(shown.to).toBe('2026-10-18T06:16:00.000Z');
    const format = { time: (iso: string) => iso.slice(11, 16), dateTime: (iso: string) => iso.slice(0, 16).replace('T', ' ') };
    expect(windowRangeText(shown, format)).toBe('Last 24 h · 06:16–06:16');
    const week = shownWindow(parseEventFilters(new URLSearchParams('window=7d'), NOW));
    expect(windowRangeText(week, format)).toBe('Last 7 days · 2026-10-11 06:16–2026-10-18 06:16');
    expect(windowRangeText({ label: 'Custom', from: null, to: null }, format)).toBe('Custom');
  });

  it('QA audit L2: a one-day window of chosen bounds names its day, once', () => {
    const format = { time: (iso: string) => iso.slice(11, 16), dateTime: (iso: string) => iso.slice(0, 16).replace('T', ' ') };
    const day = { from: '2026-10-17T06:00:00.000Z', to: '2026-10-18T06:00:00.000Z', relative: false };
    expect(windowRangeText({ ...day, label: 'Custom range' }, format)).toBe('Custom range · 2026-10-17 06:00–06:00');
    expect(windowRangeText({ ...day, label: '2026-10-17 A' }, format)).toBe('2026-10-17 A · 06:00–06:00');
    const custom = shownWindow(parseEventFilters(new URLSearchParams('from=2026-10-17T06:00:00.000Z&to=2026-10-18T06:00:00.000Z&window=Custom%20range'), NOW));
    expect(custom.relative).toBe(false);
    expect(windowRangeText(custom, format)).toBe('Custom range · 2026-10-17 06:00–06:00');
  });

  it('E-1: the start-time order is a server sort kept in the URL', () => {
    const oldest = parseEventFilters(new URLSearchParams('window=24h&sort=oldest'), NOW);
    expect(oldest.sort).toBe('oldest');
    expect(toEventQuery(oldest).sort).toBe('startTime');
    expect(toEventSearchParams(oldest).get('sort')).toBe('oldest');
    const newest = parseEventFilters(new URLSearchParams('window=24h'), NOW);
    expect(toEventQuery(newest).sort).toBe('-startTime');
    expect(toEventSearchParams(newest).has('sort')).toBe(false);
  });
});

describe('E-4 duration input', () => {
  it.each([
    ['150', 9000],
    ['1.5', 90],
    ['2:30', 9000],
    ['2h 30m', 9000],
    ['2h30m', 9000],
    ['45m', 2700],
    ['45 min', 2700],
    ['1.5h', 5400],
    ['2d 3h', 183600],
    ['3d', 259200],
  ])('reads %s as %d s', (text, seconds) => {
    expect(parseDurationInput(text)).toBe(seconds);
  });

  it('empty is no duration; anything else is unreadable', () => {
    expect(parseDurationInput('  ')).toBeNull();
    for (const text of ['soon', '-5', '2:75', 'h', '2x']) expect(parseDurationInput(text)).toBeNaN();
  });
});

describe('event form payloads (A-1, E-3, E-4)', () => {
  const base = { ...EMPTY_FORM, unitId: 'u1', startLocal: '2026-10-09T08:00', endLocal: '2026-10-09T09:00' };

  it('end-time mode sends the end and never a typed duration', () => {
    expect(toCreateBody({ ...base, durationMinutes: '30' }, UTC)).toEqual({
      unitId: 'u1', startTime: '2026-10-09T08:00:00.000Z', physicalType: 'downtime', endTime: '2026-10-09T09:00:00.000Z',
    });
  });

  it('duration mode sends the duration and not the end; a missing or unreadable one is flagged', () => {
    const byDuration = { ...base, intervalMode: 'duration' as const, durationMinutes: '2h 30m' };
    expect(toCreateBody(byDuration, UTC)).toMatchObject({ durationSeconds: 9000 });
    expect(toCreateBody(byDuration, UTC)).not.toHaveProperty('endTime');
    expect(validateEventForm({ ...byDuration, durationMinutes: '' }, 'create', UTC).durationMinutes).toBeDefined();
    expect(validateEventForm({ ...byDuration, durationMinutes: 'soon' }, 'create', UTC).durationMinutes).toBeDefined();
    expect(validateEventForm(byDuration, 'create', UTC)).toEqual({});
  });

  it('A-1 / E-3: asset and investigation pending are sent on create and edit (DTO assetId / investigationPending)', () => {
    expect(toCreateBody({ ...base, assetId: 'a1', investigationPending: true }, UTC)).toMatchObject({ assetId: 'a1', investigationPending: true });
    expect(toCreateBody(base, UTC)).not.toHaveProperty('assetId');
    expect(toCreateBody(base, UTC)).not.toHaveProperty('investigationPending');
    const event = {
      unitId: 'u1', assetId: 'a1', investigationPending: true, startTime: '2026-10-09T08:00:00.000Z', endTime: '2026-10-09T09:00:00.000Z',
      classification: { physicalType: 'downtime', scheduleClass: 'unplanned' }, reasonCodeId: null, description: null,
    } as unknown as ProductionEventView;
    const initial = formValuesOf(event, UTC);
    expect(initial).toMatchObject({ assetId: 'a1', investigationPending: true, intervalMode: 'end' });
    expect(toPatchBody(initial, { ...initial, assetId: 'a2' }, UTC)).toEqual({ assetId: 'a2' });
    expect(toPatchBody(initial, { ...initial, assetId: '' }, UTC)).toEqual({ assetId: null });
    expect(toPatchBody(initial, { ...initial, investigationPending: false }, UTC)).toEqual({ investigationPending: false });
    expect(toPatchBody(initial, { ...initial, durationMinutes: '30' }, UTC)).toEqual({});
  });

  it('E-3: the edit title names unit, kind and start in plant time', () => {
    const event = { unitId: 'u1', startTime: '2026-10-15T19:09:00.000Z', classification: { physicalType: 'downtime' } } as ProductionEventView;
    expect(editTitleOf(event, () => 'Unit 100', () => '2026-10-15 22:39')).toBe('Unit 100 · Stop from 2026-10-15 22:39');
    expect(editTitleOf({ ...event, classification: { ...event.classification, physicalType: 'quality_loss' } }, () => 'Unit 100', () => 'x')).toMatch(/^Unit 100 · Quality/);
  });
});
