import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { LinesWithoutEventView } from '@/api/v2/types/pla-analytics';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'Asia/Tehran', units: [], unitName: (id: string) => `Unit ${id}` }) }));
vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canViewAnalysis: true }) }));

const LINES: LinesWithoutEventView = {
  ledger: 'plan',
  kinds: ['performance'],
  total: 1,
  items: [
    {
      lineId: 'l1', origin: 'approved', periodId: 'p-a', planId: 'plan-1', unitId: 'u1', localDate: '2026-10-17', shiftName: 'A', periodStart: '2026-10-17T02:30:00.000Z',
      kind: 'performance', quantity: '4', uom: 't', reasonCodeId: 'r9', reasonLabel: 'SPEED-LOSS Reduced extrusion rate',
      reason: 'Observed rate deficit after the 09:00 restart', comment: null, evidenceType: 'log', evidenceRef: 'shift log',
    },
  ],
};
let asked: unknown[] = [];
vi.mock('@/api/v2/queries/pla-analytics', async (original) => ({
  ...await original<typeof import('@/api/v2/queries/pla-analytics')>(),
  useLinesWithoutEvent: (query: unknown) => {
    asked.push(query);
    return { data: query ? { data: LINES } : undefined };
  },
}));

const { parseScope } = await import('./model/analytics-scope');
const { lineEvidenceText, linesWithoutEventQuery } = await import('./model/lines-without-event');
const { LinesWithoutEvent } = await import('./tabs/lines-without-event');

const scopeOf = (oee: string) => parseScope(new URLSearchParams(`from=2026-10-17T02:30:00.000Z&to=2026-10-18T02:30:00.000Z&oee=${oee}`), 0);

describe('QA PLA M3 re-test: the Performance drill of a manual line', () => {
  it('asks for the eventless lines of the component (plan ledger); quality goes to dispositions instead', () => {
    const performance = scopeOf('performance');
    expect(performance.eventOee).toBe('performance');
    expect(linesWithoutEventQuery(performance)).toMatchObject({ ledger: 'plan', kinds: ['performance'] });
    expect(linesWithoutEventQuery(scopeOf('quality'))).toBeNull();
    expect(linesWithoutEventQuery(scopeOf('all'))?.kinds).toEqual(['availability', 'performance']);
  });

  it('shows the manual line with its reason, evidence and a link to its period instead of an empty list', () => {
    asked = [];
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <LinesWithoutEvent scope={scopeOf('performance')} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const section = screen.getByTestId('lines-without-event');
    expect(section).toHaveTextContent('SPEED-LOSS Reduced extrusion rate');
    expect(section).toHaveTextContent('4.00 t');
    expect(section).toHaveTextContent('Observed rate deficit after the 09:00 restart · Log: shift log');
    expect(section).toHaveTextContent('1 loss line of this component (Performance)');
    expect(screen.getByTestId('line-without-event-period')).toHaveAttribute('href', '/plans/plan-1/periods/p-a');
  });

  it('evidence words: reason, comment and cited record; a calculated line says it has no cause event', () => {
    expect(lineEvidenceText({ reason: null, comment: null, evidenceType: null, evidenceRef: null, origin: 'run' })).toBe('Calculated line without a cause event');
    expect(lineEvidenceText({ reason: 'r', comment: 'r', evidenceType: null, evidenceRef: 'WO-1', origin: 'approved' })).toBe('r · WO-1');
    expect(lineEvidenceText({ reason: null, comment: null, evidenceType: null, evidenceRef: null, origin: 'approved' })).toBe('No evidence recorded');
  });
});
