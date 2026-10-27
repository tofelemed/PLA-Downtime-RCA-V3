import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';

const STATEMENT = {
  planned: '240', actual: '208', shortfall: '32', availability: '23', performance: '11', quality: '6', transitionExcess: '0', unaccountedClassified: '0',
  grossAttributed: '40', recovery: '8', recoveryVerified: false, netAccounted: '32', toleranceAdjustment: '0', unaccounted: '0', uom: 't', revisionState: 'provisional',
};
const asked: unknown[] = [];
vi.mock('@/api/v2/queries/production-days', () => ({
  useProductionDay: (unitId: string, localDate: string | null) => {
    asked.push([unitId, localDate]);
    return { data: { accounting: { statement: STATEMENT, incomplete: 0 } }, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  },
}));

const { DayAccountingCard } = await import('./day-accounting-card');

const PERIOD = { periodId: 'p-29', utcStart: '2026-10-29T02:30:00.000Z', utcEnd: '2026-10-30T02:30:00.000Z', localDate: '2026-10-29', shiftName: null };
const event = (period: typeof PERIOD | null) => ({ id: 'e-1', unitId: 'u-1', accountingPeriod: period }) as unknown as ProductionEventView;

describe('event page: Day accounting card (Task 13)', () => {
  it("shows the day's statement with the unverified recovery label and links to the period row", () => {
    render(<MemoryRouter><DayAccountingCard event={event(PERIOD)} /></MemoryRouter>);
    expect(asked.at(-1)).toEqual(['u-1', '2026-10-29']);
    const card = within(screen.getByTestId('day-accounting-statement'));
    expect(card.getByText('Recovery (unverified)')).toBeInTheDocument();
    expect(card.getByTestId('statement-marker')).toHaveTextContent('Provisional');
    expect(card.getAllByTestId('statement-row').find((r) => r.getAttribute('data-key') === 'recovery')).toHaveTextContent('−8.000');
    expect(screen.getByTestId('day-accounting-link').getAttribute('href')).toContain('focus=p-29');
  });

  it('says so when no period covers the event', () => {
    render(<MemoryRouter><DayAccountingCard event={event(null)} /></MemoryRouter>);
    expect(screen.getByTestId('day-accounting-none')).toHaveTextContent('No accounting period covers this event yet.');
  });
});
