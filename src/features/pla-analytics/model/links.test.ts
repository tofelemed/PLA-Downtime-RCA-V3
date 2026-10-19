import { describe, expect, it } from 'vitest';
import { lossEventsQuery, parseScope } from './analytics-scope';
import { eventsByReasonLink, lossGroupLink, noLinkReason, QUALITY_DISPOSITIONS, waterfallBarLink } from './links';
import { parsePeriodListFilter, periodRowHref } from './period-list';

const SCOPE = parseScope(new URLSearchParams('from=2026-10-01T00:00:00.000Z&to=2026-10-08T00:00:00.000Z&window=W&units=u2,u1&approved=1'), 0);
const searchOf = (to: unknown) => new URLSearchParams((to as { search: string }).search);
const pathOf = (to: unknown) => (to as { pathname: string }).pathname;
const coded = (key: string | null, eventLines = 1) => ({ key, eventLines });

describe('PLA drill-downs (UX audit D-6)', () => {
  it('a reason row opens the Event Hub with the same window, units and that reason', () => {
    const url = new URL(eventsByReasonLink(SCOPE, 'r1'), 'http://app');
    expect(url.pathname).toBe('/events');
    expect(Object.fromEntries(url.searchParams)).toEqual({ from: SCOPE.from, to: SCOPE.to, window: 'W', units: 'u1,u2', reasons: 'r1' });
    expect(lossGroupLink(SCOPE, 'reason', coded('r1'))).toBe(eventsByReasonLink(SCOPE, 'r1'));
  });

  it('a unit or OEE-component row opens Losses → Loss events of this scope narrowed to it', () => {
    const unitLink = lossGroupLink(SCOPE, 'unit', coded('u2'));
    expect(pathOf(unitLink)).toBe('/pla-analytics/losses');
    const unit = searchOf(unitLink);
    expect(unit.get('tab')).toBeNull();
    expect(unit.get('breakdown')).toBe('loss-events');
    expect(unit.get('units')).toBe('u2');
    expect(unit.get('approved')).toBe('1');
    expect(searchOf(lossGroupLink(SCOPE, 'oee', coded('performance'))).get('oee')).toBe('performance');
  });

  it('impact rows, bridge kinds and the "Not coded" group have no link', () => {
    expect(lossGroupLink(SCOPE, 'impact', coded('i1'))).toBeNull();
    expect(lossGroupLink(SCOPE, 'kind', coded('bridge'))).toBeNull();
    expect(lossGroupLink(SCOPE, 'reason', coded(null, 0))).toBeNull();
  });

  it('QA PLA M3: quality (dispositions, not events) opens the periods’ Actuals & quality; a manual-only reason has no link and says why', () => {
    for (const to of [lossGroupLink(SCOPE, 'kind', coded('quality')), lossGroupLink(SCOPE, 'oee', coded('quality')), lossGroupLink(SCOPE, 'reason', coded(QUALITY_DISPOSITIONS, 0)), waterfallBarLink(SCOPE, 'quality')]) {
      expect(pathOf(to)).toBe('/pla-analytics/reconciliation');
      const filter = parsePeriodListFilter(searchOf(to));
      expect(filter?.kind).toBe('quality');
      expect(periodRowHref(filter!, 'p1', 'x1')).toBe('/plans/p1/periods/x1/actuals');
    }
    expect(lossGroupLink(SCOPE, 'reason', coded('speed-loss', 0))).toBeNull();
    expect(noLinkReason('reason', coded('speed-loss', 0))).toMatch(/no event/);
    expect(noLinkReason('reason', coded('r1'))).toBeNull();
  });

  it('waterfall loss bars open their loss events; Unaccounted opens reconciliation; totals have none', () => {
    expect(searchOf(waterfallBarLink(SCOPE, 'availability')).get('oee')).toBe('availability');
    expect(pathOf(waterfallBarLink(SCOPE, 'unaccounted'))).toBe('/pla-analytics/reconciliation');
    expect(waterfallBarLink(SCOPE, 'target')).toBeNull();
  });

  it('the OEE component reaches the server as oeeComponents and survives the URL', () => {
    const scope = parseScope(searchOf(waterfallBarLink(SCOPE, 'availability')), 0);
    expect(scope.eventOee).toBe('availability');
    expect(lossEventsQuery(scope).oeeComponents).toEqual(['availability']);
    expect(lossEventsQuery(SCOPE).oeeComponents).toBeUndefined();
  });
});
