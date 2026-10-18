import { describe, expect, it } from 'vitest';
import type { KpiAggregateView } from '@/api/v2/types/reports';
import { sharedUnavailableReason, unavailableReason } from './kpi-unavailable';

const kpi = (patch: Partial<KpiAggregateView>): KpiAggregateView => ({
  metric: 'oee', numerator: '0', denominator: '0', value: null, unit: 'ratio', quality: 'unavailable', reason: 'no_scheduled_time', rows: 1, missing: 0, ...patch,
});

describe('unavailable KPI reasons', () => {
  it('says why a tile has no value, and nothing when it has one', () => {
    expect(unavailableReason(kpi({}))).toBe('No scheduled time');
    expect(unavailableReason(undefined)).toBe('No calculated periods');
    expect(unavailableReason(kpi({ value: '0.875', quality: 'ok', reason: null }))).toBeNull();
  });

  it('says a reason once for the group only when every tile shares it', () => {
    expect(sharedUnavailableReason([kpi({}), kpi({ metric: 'availability' }), kpi({ metric: 'quality' })])).toBe('No scheduled time');
    expect(sharedUnavailableReason([kpi({}), kpi({ reason: 'no_output' })])).toBeNull();
    expect(sharedUnavailableReason([kpi({}), kpi({ value: '0.5', reason: null })])).toBeNull();
    expect(sharedUnavailableReason([kpi({})])).toBeNull();
  });
});
