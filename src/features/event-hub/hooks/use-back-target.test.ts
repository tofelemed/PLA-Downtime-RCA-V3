import { describe, expect, it } from 'vitest';
import { eventBackTarget } from './use-back-target';

describe('event return destination', () => {
  it.each([
    ['/events?unitId=unit100&search=pump', 'Event Hub'],
    ['/events/?status=open#results', 'Event Hub'],
    ['/events/86fdc60d-8da1-44fb-a51f-077868907180?tab=history', 'Event'],
    ['/downtime?unitIds=unit200&from=2026-10-15', 'Downtime analysis'],
  ])('retains the trusted route and its filters: %s', (to, label) => {
    expect(eventBackTarget(to)).toEqual({ to, label });
  });

  it.each([
    undefined, null, {}, 7, '', 'https://example.com/events', '//example.com/events',
    'javascript:alert(1)', '/\\example.com/events', '/events\\..\\admin',
    '/events/../admin', '/events/%2e%2e/admin', '/events/%2f%2fexample.com',
    '/downtime-other', '/events-other', '/admin', ' /events', '/events\n',
  ])('refuses external, unrelated and ambiguous navigation: %s', (value) => {
    expect(eventBackTarget(value)).toEqual({ to: '/events', label: 'Event Hub' });
  });
});
