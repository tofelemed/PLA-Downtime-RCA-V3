import { describe, expect, it } from 'vitest';
import { lossEventsQuery, parseScope } from './analytics-scope';
import { eventsByReasonLink, lossGroupLink, waterfallBarLink } from './links';

const SCOPE = parseScope(new URLSearchParams('from=2026-10-01T00:00:00.000Z&to=2026-10-08T00:00:00.000Z&window=W&units=u2,u1&approved=1'), 0);
const searchOf = (to: unknown) => new URLSearchParams((to as { search: string }).search);

describe('PLA drill-downs (UX audit D-6)', () => {
  it('a reason row opens the Event Hub with the same window, units and that reason', () => {
    const url = new URL(eventsByReasonLink(SCOPE, 'r1'), 'http://app');
    expect(url.pathname).toBe('/events');
    expect(Object.fromEntries(url.searchParams)).toEqual({ from: SCOPE.from, to: SCOPE.to, window: 'W', units: 'u1,u2', reasons: 'r1' });
    expect(lossGroupLink(SCOPE, 'reason', 'r1')).toBe(eventsByReasonLink(SCOPE, 'r1'));
  });

  it('a unit or OEE-component row opens Losses → Loss events of this scope narrowed to it', () => {
    const unit = searchOf(lossGroupLink(SCOPE, 'unit', 'u2'));
    expect(unit.get('tab')).toBe('losses');
    expect(unit.get('breakdown')).toBe('loss-events');
    expect(unit.get('units')).toBe('u2');
    expect(unit.get('approved')).toBe('1');
    expect(searchOf(lossGroupLink(SCOPE, 'oee', 'performance')).get('oee')).toBe('performance');
    expect(searchOf(lossGroupLink(SCOPE, 'kind', 'quality')).get('oee')).toBe('quality');
  });

  it('impact rows, bridge kinds and the "Not coded" group have no link', () => {
    expect(lossGroupLink(SCOPE, 'impact', 'i1')).toBeNull();
    expect(lossGroupLink(SCOPE, 'kind', 'bridge')).toBeNull();
    expect(lossGroupLink(SCOPE, 'reason', null)).toBeNull();
  });

  it('waterfall loss bars open their loss events; Unaccounted opens reconciliation; totals have none', () => {
    expect(searchOf(waterfallBarLink(SCOPE, 'availability')).get('oee')).toBe('availability');
    expect(searchOf(waterfallBarLink(SCOPE, 'unaccounted')).get('tab')).toBe('reconciliation');
    expect(waterfallBarLink(SCOPE, 'target')).toBeNull();
  });

  it('the OEE component reaches the server as oeeComponents and survives the URL', () => {
    const scope = parseScope(searchOf(waterfallBarLink(SCOPE, 'availability')), 0);
    expect(scope.eventOee).toBe('availability');
    expect(lossEventsQuery(scope).oeeComponents).toEqual(['availability']);
    expect(lossEventsQuery(SCOPE).oeeComponents).toBeUndefined();
  });
});
