import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { parseEventFilters } from '@/features/event-hub/model/event-url';
import { parseFilters as parseDowntimeFilters } from '@/features/downtime-analysis/model/downtime-filters';
import { parseScope } from '@/features/pla-analytics/model/analytics-scope';
import { analysisAreaOf, analysisContextParams, readAnalysisContext, withAnalysisContext } from './analysis-context';
import { useAnalysisContext } from './use-analysis-context';

const NOW = Date.parse('2026-10-18T08:00:00Z');
const FROM = '2026-10-01T00:00:00.000Z';
const TO = '2026-10-08T00:00:00.000Z';
const paramsOf = (href: string) => new URL(href, 'http://app').searchParams;

describe('shared analysis context (UX audit B-8)', () => {
  it('reads units, explicit bounds with their label, and approved from a URL', () => {
    expect(readAnalysisContext(`?units=u2,u1&from=${FROM}&to=${TO}&window=Week%2040&approved=1&kinds=downtime`)).toEqual({
      unitIds: ['u1', 'u2'], from: FROM, to: TO, windowLabel: 'Week 40', approved: true,
    });
  });

  it('keeps a rolling window as its key (also from an older label) and drops broken bounds', () => {
    expect(readAnalysisContext('?window=24h')).toEqual({ relativeWindow: '24h' });
    expect(readAnalysisContext('?window=Last%2030%20days')).toEqual({ relativeWindow: '30d' });
    expect(readAnalysisContext(`?from=${TO}&to=${FROM}&approved=x`)).toEqual({});
  });

  it('writes a rolling window as its key only, and round-trips', () => {
    expect(analysisContextParams({ relativeWindow: '7d', from: FROM, to: TO, approved: false }).toString()).toBe('window=7d&approved=0');
    const context = { unitIds: ['u1'], from: FROM, to: TO, windowLabel: 'Custom window' };
    expect(readAnalysisContext(analysisContextParams(context))).toEqual(context);
  });

  it('adds the context to a link without overriding what the link names, keeping the hash', () => {
    expect(withAnalysisContext('/events?kinds=downtime#list', { relativeWindow: '30d', unitIds: ['u1'] })).toBe('/events?kinds=downtime&window=30d&units=u1#list');
    expect(withAnalysisContext('/downtime?window=24h&units=u9', { from: FROM, to: TO, unitIds: ['u1'] })).toBe('/downtime?window=24h&units=u9');
    expect(withAnalysisContext('/reports', {})).toBe('/reports');
  });

  it('every target module resolves the same window from the link', () => {
    const href = (path: string) => withAnalysisContext(path, { relativeWindow: '30d', unitIds: ['u1'] });
    const downtime = parseDowntimeFilters(paramsOf(href('/downtime')), NOW);
    const pla = parseScope(paramsOf(href('/pla-analytics')), NOW);
    const events = parseEventFilters(paramsOf(href('/events')), NOW);
    expect([downtime.relativeWindow, downtime.unitIds]).toEqual(['30d', ['u1']]);
    expect([pla.windowLabel, pla.unitIds, pla.from, pla.to]).toEqual([downtime.windowLabel, ['u1'], downtime.from, downtime.to]);
    expect([events.relativeWindow, events.unitIds]).toEqual(['30d', ['u1']]);
  });

  it('names the analysis modules by path', () => {
    expect(['/dashboard', '/events/e1', '/downtime/causes', '/pla-analytics', '/reports', '/rca', '/eventsx'].map(analysisAreaOf)).toEqual([
      'dashboard', 'events', 'downtime', 'pla', 'reports', null, null,
    ]);
  });

  it('useAnalysisContext reads the current URL', () => {
    function Probe() {
      return <output data-testid="ctx">{JSON.stringify(useAnalysisContext())}</output>;
    }
    render(
      <MemoryRouter initialEntries={['/downtime?window=8h&units=u3']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(JSON.parse(screen.getByTestId('ctx').textContent ?? '{}')).toEqual({ relativeWindow: '8h', unitIds: ['u3'] });
  });
});
