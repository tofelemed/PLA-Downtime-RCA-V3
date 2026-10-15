import { describe, expect, it } from 'vitest';
import { parseFilters } from './downtime-filters';
import { lostProductionQuery } from './lost-production';

const NOW = Date.parse('2026-10-12T10:00:00.000Z');

describe('lost production by stop reason (FE-08)', () => {
  it('asks the loss tree for the availability lines of the page scope, per reason, largest 20', () => {
    const filters = parseFilters(new URLSearchParams('units=u2,u1&from=2026-10-01T00:00:00Z&to=2026-10-08T00:00:00Z'), NOW);
    expect(lostProductionQuery(filters, 'qty')).toEqual({
      from: filters.from,
      to: filters.to,
      unitIds: ['u1', 'u2'],
      groupBy: 'reason',
      metric: 'qty',
      ledger: 'plan',
      kinds: ['availability'],
      limit: 20,
    });
    expect(lostProductionQuery(filters, 'value').metric).toBe('value');
  });
});
