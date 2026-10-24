import { describe, expect, it } from 'vitest';
import { DASHBOARD_PRESETS, dashboardScope, presetKeyOf, stepOf, type DashboardPresetKey } from './dashboard-scope';
import { oeeQuery, scopeBase } from './analytics-scope';

const NOW = Date.parse('2026-10-18T08:00:00Z');

describe('dashboard scope', () => {
  it('offers the six periods with their labels', () => {
    expect(DASHBOARD_PRESETS.map((p) => [p.key, p.label, p.hours])).toEqual([
      ['24h', '24 h', 24], ['7d', '7 days', 168], ['30d', '30 days', 720], ['3m', '3 months', 2184], ['6m', '6 months', 4368], ['1y', '1 year', 8760],
    ]);
  });

  it('maps each period to its chart step', () => {
    const steps = (['24h', '7d', '30d', '3m', '6m', '1y'] as DashboardPresetKey[]).map(stepOf);
    expect(steps).toEqual(['shift', 'day', 'day', 'week', 'month', 'month']);
    expect(dashboardScope('3m', {}, NOW).trendBy).toBe('week');
  });

  it('follows the hierarchy node', () => {
    expect(dashboardScope('7d', { unitId: 'u1', assetId: 'a1' }, NOW).unitIds).toEqual(['u1']);
    expect(dashboardScope('1y', {}, NOW).unitIds).toEqual([]);
    expect(dashboardScope('30d', {}, NOW).windowLabel).toBe('30 days');
  });

  it('falls back to 7 days for an unknown key', () => {
    expect(presetKeyOf('90d')).toBe('7d');
    expect(presetKeyOf(null)).toBe('7d');
    expect(presetKeyOf('6m')).toBe('6m');
  });

  it('shows approved revisions only for every period (owner decision 24 Oct 2026)', () => {
    for (const preset of DASHBOARD_PRESETS) {
      expect(dashboardScope(preset.key, {}, NOW).approvedOnly).toBe(true);
      expect(dashboardScope(preset.key, { unitId: 'u1' }, NOW).approvedOnly).toBe(true);
    }
  });

  it('sends approvedOnly with a section request', () => {
    const scope = dashboardScope('7d', {}, NOW);
    expect(scopeBase(scope).approvedOnly).toBe(true);
    expect(oeeQuery(scope, 'unit').approvedOnly).toBe(true);
  });
});
