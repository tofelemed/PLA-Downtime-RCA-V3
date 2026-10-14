import { describe, expect, it } from 'vitest';
import { defaultFilters, toEventQuery } from './event-filters';
import { parseEventFilters, toEventSearchParams } from './event-url';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { factLabel, factText, type FactResolvers } from './fact-display';

const NOW = Date.parse('2026-10-12T10:00:30.000Z');
const UUID = '5c0b12aa-1111-4222-8333-944445555666';

describe('Event Hub filters in the URL', () => {
  it('a missing window is the last 7 days, minute-stable, ending one hour after now', () => {
    const filters = parseEventFilters(new URLSearchParams(), NOW);
    expect(filters.windowLabel).toBe('Last 7 days');
    expect(filters.to).toBe('2026-10-12T11:01:00.000Z');
    expect(filters.from).toBe('2026-10-05T10:01:00.000Z');
    expect(filters.physicalStates).toEqual(['open', 'closed']);
  });

  it('round-trips every filter and leaves defaults out of the URL', () => {
    const state = {
      ...defaultFilters({ from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z', label: 'Last 7 days' }),
      unitIds: ['u2', 'u1'],
      eventTypes: ['IOW'],
      sourceKinds: ['manual'],
      severities: ['High'],
      q: ' belt ',
      isOpen: 'closed' as const,
    };
    const params = toEventSearchParams(state);
    expect(params.get('units')).toBe('u1,u2');
    expect(params.has('states')).toBe(false);
    expect(params.get('q')).toBe('belt');
    const back = parseEventFilters(params, NOW);
    expect(back).toMatchObject({ unitIds: ['u1', 'u2'], eventTypes: ['IOW'], sourceKinds: ['manual'], severities: ['High'], q: 'belt', isOpen: 'closed', windowLabel: 'Last 7 days' });
  });

  it('a cleared state filter means "all states" (superseded and retracted included)', () => {
    const state = { ...parseEventFilters(new URLSearchParams(), NOW), physicalStates: [] };
    const params = toEventSearchParams(state);
    expect(params.get('states')).toBe('all');
    expect(parseEventFilters(params, NOW).physicalStates).toEqual([]);
    expect(toEventQuery(parseEventFilters(params, NOW)).physicalStates).toBeUndefined();
  });

  it('possible duplicates (DT-04): only sent and kept in the URL when ticked', () => {
    const base = parseEventFilters(new URLSearchParams(), NOW);
    expect(base.possibleDuplicate).toBe(false);
    expect('possibleDuplicate' in toEventQuery(base)).toBe(false);
    expect(toEventSearchParams(base).has('duplicates')).toBe(false);
    const ticked = { ...base, possibleDuplicate: true };
    expect(toEventQuery(ticked).possibleDuplicate).toBe(true);
    const params = toEventSearchParams(ticked);
    expect(params.get('duplicates')).toBe('1');
    expect(parseEventFilters(params, NOW).possibleDuplicate).toBe(true);
  });

  it('possible repeats (SME D5): only sent and kept in the URL when ticked', () => {
    const base = parseEventFilters(new URLSearchParams(), NOW);
    expect(base.possibleRepeat).toBe(false);
    expect('possibleRepeat' in toEventQuery(base)).toBe(false);
    const ticked = { ...base, possibleRepeat: true };
    expect(toEventQuery(ticked).possibleRepeat).toBe(true);
    const params = toEventSearchParams(ticked);
    expect(params.get('repeats')).toBe('1');
    expect(parseEventFilters(params, NOW).possibleRepeat).toBe(true);
  });

  it('sends the new filters to the server; search only from two characters', () => {
    const base = parseEventFilters(new URLSearchParams(), NOW);
    expect('q' in toEventQuery({ ...base, q: 'x' })).toBe(false);
    expect(toEventQuery({ ...base, q: 'pump', eventTypes: ['SOL', 'APM'] })).toMatchObject({ q: 'pump', eventTypes: ['APM', 'SOL'] });
  });
});

describe('revision facts are shown without internal values', () => {
  const resolvers: FactResolvers = {
    unitName: () => 'Extruder 1',
    assetName: () => 'Pump A',
    reasonName: () => 'MECH · Mechanical',
    impactName: () => 'IMP · Full stop',
    userName: () => 'Jonas Weber',
    dateTime: () => '2026-10-12 06:30',
    duration: (seconds) => formatDuration(seconds, 'long', 'persian'),
  };

  it('labels fields and resolves ids, times, durations and enum tokens', () => {
    expect(factLabel('reasonCodeId')).toBe('Reason');
    expect(factLabel('someNewField')).toBe('Some new field');
    expect(factText('assetId', UUID, resolvers)).toBe('Pump A');
    expect(factText('startTime', '2026-10-12T03:00:00.000Z', resolvers)).toBe('2026-10-12 06:30');
    expect(factText('durationSeconds', 5400, resolvers)).toBe('۱ h ۳۰ min');
    expect(factText('physicalType', 'quality_loss', resolvers)).toBe('Quality loss');
    expect(factText('apmType', 'FailureWO', resolvers)).toBe('Failure work order');
    expect(factText('description', null, resolvers)).toBe('—');
  });

  it('never prints an unknown id or a JSON dump', () => {
    expect(factText('planId', UUID, resolvers)).toBe('Linked record');
    const text = factText('extra', { unitId: UUID, note: 'ok' }, resolvers);
    expect(text).toBe('Unit: Extruder 1 · Note: ok');
    expect(text).not.toContain('{');
  });
});
