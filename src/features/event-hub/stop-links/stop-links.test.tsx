import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { StopEventSummaryView, StopIncidentView, StopReconciliationView } from '@/api/v2/types/stop-events';
import { DuplicatesSection } from './duplicates-section';
import { IncidentSection } from './incident-section';

const command = { submit: vi.fn(), error: null };
vi.mock('@/api/v2/queries/stop-events', () => ({
  useDuplicateDecision: () => command,
  useNewFailureMark: () => command,
}));
vi.mock('../hooks/use-plant-format', () => ({
  usePlantFormat: () => ({
    dateTime: (iso: string | null) => iso ?? '',
    duration: (seconds: number) => `${seconds} s`,
    number: (n: number) => String(n),
  }),
}));

const summary = (id: string, sourceKind: string, occurrenceId = id): StopEventSummaryView => ({
  id,
  sourceKind,
  source: null,
  assetId: null,
  reasonCodeId: null,
  startTime: '2026-10-15T10:00:00.000Z',
  endTime: '2026-10-15T11:00:00.000Z',
  durationSeconds: 3600,
  physicalState: 'closed',
  occurrenceId,
});

const pair = (state: StopReconciliationView['state'], extra: Partial<StopReconciliationView> = {}): StopReconciliationView => ({
  id: `p-${state}`,
  unitId: 'u1',
  state,
  mode: 'auto',
  suggestionReason: null,
  startDeltaSeconds: 5,
  endDeltaSeconds: 10,
  toleranceSeconds: 120,
  conflicts: [],
  copied: {},
  kept: summary('derived', 'derived'),
  evidence: summary('manual', 'manual'),
  decidedBy: null,
  decidedAt: null,
  decisionReason: null,
  createdAt: '2026-10-15T11:01:00.000Z',
  rowVersion: 1,
  ...extra,
});

const show = (node: ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe('duplicates and repeats of a stop (DT-04, SME D5)', () => {
  it('a merged duplicate names the other record, what was copied, and offers undo', () => {
    show(<DuplicatesSection pairs={[pair('merged', { copied: { reasonCodeId: 'r1' } })]} eventId="derived" canDecide />);
    expect(screen.getByText('Merged duplicate')).toBeInTheDocument();
    expect(screen.getByText(/Duplicate:/)).toHaveTextContent('Manual entry');
    expect(screen.getByTestId('duplicate-pair')).toHaveTextContent('Copied to the kept stop: reason');
    expect(screen.getByTestId('duplicate-undo')).toBeInTheDocument();
  });

  it('a suggestion says why it was not merged and offers merge / keep both; read-only users get no buttons', () => {
    const suggested = pair('suggested', { suggestionReason: 'cause_conflict', conflicts: ['reasonCodeId'] });
    const { unmount } = show(<DuplicatesSection pairs={[suggested]} eventId="manual" canDecide />);
    expect(screen.getByTestId('duplicate-pair')).toHaveTextContent('the causes differ');
    expect(screen.getByText(/Kept stop:/)).toHaveTextContent('State engine');
    expect(screen.getByTestId('duplicate-accept')).toBeInTheDocument();
    expect(screen.getByTestId('duplicate-reject')).toBeInTheDocument();
    unmount();
    show(<DuplicatesSection pairs={[suggested]} eventId="manual" canDecide={false} />);
    expect(screen.queryByTestId('duplicate-accept')).not.toBeInTheDocument();
  });

  it('an incident shows stopped time (not the envelope), its stops, and the new-failure action on a later stop', () => {
    const incident: StopIncidentView = {
      id: 'i1',
      unitId: 'u1',
      assetId: 'a1',
      reasonCodeId: 'jam',
      startTime: '2026-10-15T10:00:00.000Z',
      endTime: '2026-10-15T10:09:00.000Z',
      stopCount: 2,
      stoppedSeconds: 420,
      envelopeSeconds: 540,
      windowSeconds: 120,
      stops: [summary('s1', 'manual', 'o1'), summary('s2', 'source', 'o2')],
      newFailureOccurrenceIds: [],
    };
    show(<IncidentSection incident={incident} eventId="s2" occurrenceId="o2" canDecide />);
    expect(screen.getByTestId('stop-incident')).toHaveTextContent('stopped 420 s within 540 s');
    expect(screen.getAllByTestId('incident-stop')).toHaveLength(2);
    expect(screen.getByTestId('incident-mark')).toBeInTheDocument();
  });

  it('a stop outside any incident says so', () => {
    show(<IncidentSection incident={null} eventId="s1" occurrenceId="o1" canDecide />);
    expect(screen.getByText('This stop is not part of a repeat-stop incident.')).toBeInTheDocument();
  });
});
