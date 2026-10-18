import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { CandidateDerivationView, CandidateView, ReconciliationLineView, ReconciliationView } from '@/api/v2/types/reconciliation';
import type { DraftState } from './model/draft-lines';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CandidateRow } = await import('./editor/candidate-row');
const { ManualLines } = await import('./editor/manual-lines');
const { rateDisplayOf } = await import('./model/candidate-derivation');
const { eventRcaById } = await import('./model/event-rca');

const DERIVATION: CandidateDerivationView = {
  basis: 'planning_rate', ledger: 'plan', segmentStart: '2026-10-08T06:00:00.000Z', segmentEnd: '2026-10-08T07:30:00.000Z', durationSeconds: 5400,
  rate: { versionId: 'rate-1', kind: 'planning', value: '12.5', timebase: 'h' }, rateScaledToTarget: true, sourceEventId: 'event-1', occurrenceId: null,
  evidence: [], flags: [],
};
const CANDIDATE: CandidateView = { lossLineId: 'l1', autoKey: 'k1', sliceId: 's1', kind: 'availability', quantity: '9.375', basis: 'planning_rate', reasonCodeId: null, impactCodeId: null, causeEventId: 'event-1', state: 'proposed', effectiveQuantity: '9.375', derivation: DERIVATION };
const wrap = (node: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
const row = (candidate: CandidateView) => wrap(<CandidateRow candidate={candidate} uom="t" saved={null} decision={null} setDraft={() => undefined} issues={[]} readOnly timezone="UTC" />);

describe('applied rate of a scaled plan candidate (UX D-2)', () => {
  it('picks the stored applied rate, the old wording only for runs before it was stored, else the version', () => {
    const applied = { value: '6.25', timebase: 'h' };
    expect(rateDisplayOf({ ...DERIVATION, appliedRate: applied })).toEqual({ mode: 'scaled', applied, planning: DERIVATION.rate });
    expect(rateDisplayOf({ ...DERIVATION, appliedRate: null })).toEqual({ mode: 'scaled-unstored' });
    expect(rateDisplayOf(DERIVATION)).toEqual({ mode: 'scaled-unstored' });
    expect(rateDisplayOf({ ...DERIVATION, rateScaledToTarget: false, appliedRate: applied })).toEqual({ mode: 'version', rate: DERIVATION.rate });
    expect(rateDisplayOf({ ...DERIVATION, rateScaledToTarget: false, rate: null })).toEqual({ mode: 'none' });
  });

  it('shows the applied rate with the planning rate it was scaled from', () => {
    row({ ...CANDIDATE, derivation: { ...DERIVATION, appliedRate: { value: '6.25', timebase: 'h' } } });
    const box = screen.getByTestId('candidate-derivation');
    expect(within(box).getByTestId('derivation-rate-applied')).toHaveTextContent('Applied rate 6.25 t/h (planning rate 12.50 t/h, scaled to target)');
    expect(within(box).queryByTestId('derivation-rate-scaled')).toBeNull();
  });

  it('keeps "the applied rate is not stored" for an older run', () => {
    row({ ...CANDIDATE, derivation: { ...DERIVATION, appliedRate: null } });
    expect(screen.getByTestId('derivation-rate-scaled')).toHaveTextContent('the applied rate is not stored');
    expect(screen.queryByTestId('derivation-rate-applied')).toBeNull();
  });
});

describe('RCA chip on loss lines (UX G-4)', () => {
  it('a candidate whose cause event has a linked investigation links to the case', () => {
    row({ ...CANDIDATE, causeEventRca: { state: 'linked', caseId: 'case-9' } });
    const chip = screen.getByTestId('event-rca-chip');
    expect(chip).toHaveTextContent('RCA linked');
    expect(chip).toHaveAttribute('href', '/rca/case-9');
  });

  it('shows "RCA recommended" for a required RCA and nothing for none or an unknown event', () => {
    const { unmount } = row({ ...CANDIDATE, causeEventRca: { state: 'required', caseId: null } });
    expect(screen.getByTestId('event-rca-chip')).toHaveTextContent('RCA recommended');
    unmount();
    const second = row({ ...CANDIDATE, causeEventRca: { state: 'none', caseId: null } });
    expect(screen.queryByTestId('event-rca-chip')).toBeNull();
    second.unmount();
    row({ ...CANDIDATE, causeEventRca: null });
    expect(screen.queryByTestId('event-rca-chip')).toBeNull();
  });

  it('manual lines show the chip of each cited event the server returned', () => {
    const saved = { id: 'm1', evidence: [{ eventId: 'event-2' }], linkedEventRca: [{ eventId: 'event-2', state: 'completed', caseId: 'case-2' }] } as unknown as ReconciliationLineView;
    const view = { slices: [{ sliceId: 's1', uom: 't' }], candidates: [{ ...CANDIDATE, causeEventRca: { state: 'linked', caseId: 'case-1' } }], lines: [saved] } as unknown as ReconciliationView;
    expect([...eventRcaById(view).keys()]).toEqual(['event-1', 'event-2']);
    const draft = {
      decisions: {}, dirty: false, pendingManual: null,
      manual: [{ uid: 'u1', sliceId: 's1', kind: 'availability', quantity: '2', eventIds: ['event-2', 'event-3'], missingEvent: false, missingCode: false }],
    } as unknown as DraftState;
    wrap(<ManualLines view={view} draft={draft} setDraft={() => undefined} issues={new Map()} readOnly timezone="UTC" />);
    const chips = within(screen.getByTestId('manual-line-events')).getAllByTestId('event-rca-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent('RCA completed');
    expect(chips[0]).toHaveAttribute('href', '/rca/case-2');
  });
});
