import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { capitalizedNoun, eventNoun, eventNounOfAll } from '@/features/ux-kit/labels';

vi.mock('./hooks/use-retract-event', () => ({ useRetractEvent: () => ({ submit: vi.fn(), error: null }) }));

const { EventStateCell } = await import('./components/event-state-cell');
const { RetractEventDialog } = await import('./components/retract-event-dialog');

const eventOf = (physicalType: string, rca: string, rcaId: string | null) =>
  ({
    id: 'e1',
    unitId: 'u1',
    rcaId,
    incidentId: null,
    classification: { physicalType, scheduleClass: 'unplanned' },
    states: { physical: 'closed', coding: 'coded', rca },
  }) as unknown as ProductionEventView;

describe('H-12 glossary: stop for downtime, event for the generic record', () => {
  it('names a downtime event a stop and every other kind an event', () => {
    expect(eventNoun('downtime')).toBe('stop');
    expect(eventNoun('slowdown')).toBe('event');
    expect(eventNoun(null)).toBe('event');
    expect(eventNounOfAll(['downtime', 'downtime'])).toBe('stop');
    expect(eventNounOfAll(['downtime', 'quality_loss'])).toBe('event');
    expect(eventNounOfAll([])).toBe('event');
    expect(capitalizedNoun('stop')).toBe('Stop');
  });

  it('asks to retract a stop for downtime and an event for other kinds', () => {
    const { unmount } = render(<RetractEventDialog event={eventOf('downtime', 'none', null)} onDone={vi.fn()} />);
    fireEvent.click(screen.getByTestId('retract-event'));
    expect(screen.getByText('Retract this stop?')).toBeInTheDocument();
    unmount();
    render(<RetractEventDialog event={eventOf('quality_loss', 'none', null)} onDone={vi.fn()} />);
    fireEvent.click(screen.getByTestId('retract-event'));
    expect(screen.getByText('Retract this event?')).toBeInTheDocument();
  });
});

describe('owner finding 2: the coding state and the accounting workflow side by side', () => {
  const cell = (event: ProductionEventView) => render(<MemoryRouter><EventStateCell event={event} /></MemoryRouter>);

  it('a stop whose period is in review reads "Accounting: in review" next to its coding chip', () => {
    cell({ ...eventOf('downtime', 'none', null), states: { physical: 'closed', coding: 'uncoded', rca: 'none' }, accountingState: 'in_review' } as ProductionEventView);
    expect(screen.getByLabelText('Coding state: Uncoded')).toBeInTheDocument();
    expect(screen.getByTestId('event-accounting-state')).toHaveTextContent('Accounting: in review');
    expect(screen.getByTestId('event-accounting-state')).toHaveAttribute('data-tone', 'info');
  });

  it('shows no accounting chip before any period is calculated (or from an older server)', () => {
    const { unmount } = cell({ ...eventOf('downtime', 'none', null), accountingState: 'none' } as ProductionEventView);
    expect(screen.queryByTestId('event-accounting-state')).toBeNull();
    unmount();
    cell(eventOf('downtime', 'none', null));
    expect(screen.queryByTestId('event-accounting-state')).toBeNull();
  });
});

describe('G-4: the event list shows the shared RCA chip', () => {
  const cell = (event: ProductionEventView) => render(<MemoryRouter><EventStateCell event={event} /></MemoryRouter>);

  it('links a linked event to its investigation instead of a plain state badge', () => {
    cell(eventOf('downtime', 'linked', 'c1'));
    expect(screen.getByTestId('event-rca-chip')).toHaveAttribute('href', '/rca/c1');
    expect(screen.getByTestId('event-rca-chip')).toHaveTextContent('RCA linked');
    expect(screen.queryByLabelText(/RCA state:/)).toBeNull();
  });

  it('shows nothing for an event without RCA and a plain chip when the view has no investigation id', () => {
    const { unmount } = cell(eventOf('downtime', 'none', null));
    expect(screen.queryByTestId('event-rca-chip')).toBeNull();
    expect(screen.queryByText('No RCA')).toBeNull();
    unmount();
    cell(eventOf('downtime', 'completed', null));
    expect(screen.getByTestId('event-rca-chip').tagName).not.toBe('A');
    expect(screen.getByTestId('event-rca-chip')).toHaveTextContent('RCA completed');
  });
});
