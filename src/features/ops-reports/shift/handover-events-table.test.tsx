import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HandoverEventView } from '@/api/v2/types/ops-reports';

vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canWriteEvents: false }) }));

const { HandoverEventsTable } = await import('./handover-events-table');
const { ShiftNotesCard } = await import('./shift-notes-card');

const base: HandoverEventView = {
  id: 'e1',
  unitId: 'u1',
  unitName: 'Reactor line 1',
  physicalType: 'downtime',
  open: false,
  codingState: 'uncoded',
  verified: false,
  start: '2027-03-01T03:30:00.000Z',
  end: '2027-03-01T04:30:00.000Z',
  seconds: '3600',
  reason: null,
  asset: null,
  fromProduct: null,
  toProduct: null,
  description: null,
};

describe('Shift handover (R2)', () => {
  it('names the grades of a transition and marks a running, uncoded stop', () => {
    const events: HandoverEventView[] = [
      { ...base, id: 'e1', open: true, end: null, seconds: null },
      { ...base, id: 'e2', physicalType: 'grade_transition', codingState: 'coded', fromProduct: 'HD5218', toProduct: 'EX3', verified: true },
    ];
    render(<HandoverEventsTable events={events} timeZone="Asia/Tehran" />);
    expect(screen.getAllByTestId('handover-event')[0]).toHaveTextContent('07:00 – running');
    expect(screen.getByText('HD5218 → EX3')).toBeInTheDocument();
    expect(screen.getByText('Not coded')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('lists the notes and offers no form to a role that records no events', () => {
    const notes = [{ id: 'n1', unitId: 'u1', localDate: '2027-03-01', shiftName: 'A', body: 'Screen pack changed', createdAt: '2027-03-01T04:00:00.000Z', createdBy: 'x', authorName: 'Omid' }];
    const instances = [{ unitId: 'u1', unitName: 'Reactor line 1', crewName: 'Crew 1', from: '', to: '', excluded: false }];
    render(<ShiftNotesCard localDate="2027-03-01" shiftName="A" instances={instances} notes={notes} timeZone="Asia/Tehran" />);
    expect(screen.getByTestId('shift-note')).toHaveTextContent('Screen pack changed');
    expect(screen.getByTestId('shift-note')).toHaveTextContent('Omid');
    expect(screen.queryByTestId('shift-note-form')).toBeNull();
  });
});
