import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';

vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canWriteEvents: false }) }));

const { EventDetailActions } = await import('./event-detail-actions');
const { ViewAccountingLink } = await import('./view-accounting-button');
const { accountingHrefOf } = await import('../model/accounting-link');

const PERIOD = { periodId: 'p-29', utcStart: '2026-10-29T02:30:00.000Z', utcEnd: '2026-10-30T02:30:00.000Z', localDate: '2026-10-29', shiftName: null };
const eventOf = (accountingPeriod: typeof PERIOD | null) =>
  ({ id: 'e-1', unitId: 'u-1', accountingPeriod, states: { physical: 'closed' }, classification: { physicalType: 'downtime' } }) as unknown as ProductionEventView;

const wrap = (node: JSX.Element) => render(<MemoryRouter>{node}</MemoryRouter>);

describe('Task 13: View accounting from the event', () => {
  it('builds the statement URL of the event period: unit, window, focus and the way back', () => {
    const href = accountingHrefOf(eventOf(PERIOD));
    expect(href).toBe('/pla-analytics/statement?from=2026-10-29T02%3A30%3A00.000Z&to=2026-10-30T02%3A30%3A00.000Z&window=dates&units=u-1&focus=p-29&source=event%3Ae-1');
    expect(accountingHrefOf(eventOf(null))).toBeNull();
  });

  it('shows the button to a read-only reader of any event with a period', () => {
    wrap(<EventDetailActions event={eventOf(PERIOD)} />);
    expect(screen.getByTestId('view-accounting')).toHaveAttribute('href', accountingHrefOf(eventOf(PERIOD)));
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
  });

  it('without a period the button is disabled and says why; the list row has no entry', () => {
    wrap(
      <>
        <EventDetailActions event={eventOf(null)} />
        <ViewAccountingLink event={eventOf(null)} />
      </>,
    );
    expect(screen.getByTestId('view-accounting-unavailable')).toHaveAttribute('title', 'No accounting period covers this event yet');
    expect(screen.getByRole('button', { name: 'View accounting' })).toBeDisabled();
    expect(screen.queryByTestId('row-view-accounting')).toBeNull();
  });
});
