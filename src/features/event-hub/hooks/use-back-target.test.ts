import { describe, expect, it } from 'vitest';
import { eventBackTarget } from './use-back-target';

describe('event return destination', () => {
  it.each([
    ['/events?unitId=unit100&search=pump', 'Event Hub'],
    ['/events/?status=open#results', 'Event Hub'],
    ['/events/86fdc60d-8da1-44fb-a51f-077868907180?tab=history', 'Event'],
    ['/downtime?unitIds=unit200&from=2026-10-15', 'Downtime analysis'],
    ['/downtime/stops?units=unit200&window=24h', 'Stops & timeline'],
    ['/downtime/causes?units=unit200', 'Causes & Pareto'],
    ['/downtime/trends', 'Trends & comparisons'],
    ['/downtime/reliability', 'Reliability (MTBF/MTTR)'],
    ['/pla-analytics?from=2026-10-01', 'Production loss analysis'],
    ['/pla-analytics/losses?units=unit100', 'Loss breakdown'],
    ['/pla-analytics/trends', 'PLA trends'],
    ['/pla-analytics/oee', 'OEE'],
    ['/pla-analytics/reconciliation', 'Reconciliation & data quality'],
    ['/pla-analytics/valuation', 'Loss valuation'],
    ['/rca/0b6f2a8e-1c3d-4e5f-9a7b-1234567890ab?tab=events', 'Investigation'],
    ['/plans/p1/periods/86fdc60d-8da1-44fb-a51f-077868907180', 'Period'],
    ['/plans/p1/periods/x2/adjustments/new?slice=s1', 'Period'],
    ['/plans/0b6f2a8e-1c3d-4e5f-9a7b-1234567890ab?tab=periods', 'Plan'],
  ])('retains the trusted route and its filters: %s', (to, label) => {
    expect(eventBackTarget(to)).toEqual({ to, label });
  });

  it.each([
    undefined, null, {}, 7, '', 'https://example.com/events', '//example.com/events',
    'javascript:alert(1)', '/\\example.com/events', '/events\\..\\admin',
    '/events/../admin', '/events/%2e%2e/admin', '/events/%2f%2fexample.com',
    '/downtime-other', '/events-other', '/admin', ' /events', '/events\n',
    '/downtime/unknown', '/pla-analytics/../admin', '/pla-analytics-x', '/rca', '/rca/', '/rca/../admin', '/rca/a/b',
    '/downtime/stops\\x', '/rca/abc\tdef',
    '/plans', '/plans/', '/plans/p1/periods', '/plans/p1/periods/', '/plans/../admin', '/plans/p1/periods/x/../../admin',
    '/plans/p1/periods/x//y', '/plans/p1/other', '/plans/p1/periods/%2e%2e', '/plans/p1/periods/x/', '/plans/p1\\periods/x',
  ])('refuses external, unrelated and ambiguous navigation: %s', (value) => {
    expect(eventBackTarget(value)).toEqual({ to: '/events', label: 'Event Hub' });
  });
});
