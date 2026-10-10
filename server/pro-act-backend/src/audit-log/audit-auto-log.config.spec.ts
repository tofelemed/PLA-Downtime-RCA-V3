import { resolveEntityType, shouldSkipAudit } from './audit-auto-log.config';

describe('audit auto-log route mapping', () => {
  it('maps v1 and v2 RCA routes to their entity types', () => {
    expect(resolveEntityType('/api/rcas/1')).toBe('RCA');
    expect(resolveEntityType('/api/v2/rcas/1/links')).toBe('RCA');
    expect(resolveEntityType('/api/v2/rca-actions/1')).toBe('RCAAction');
    expect(resolveEntityType('/api/v2/production-events/1/rca-link')).toBe(
      'ProductionEvent',
    );
  });

  it('audits writes only and keeps the skip list for versioned paths', () => {
    expect(shouldSkipAudit('/api/v2/rcas', 'GET')).toBe(true);
    expect(shouldSkipAudit('/api/v2/rcas', 'POST')).toBe(false);
    expect(shouldSkipAudit('/api/v2/reports/waterfall', 'POST')).toBe(true);
  });
});
