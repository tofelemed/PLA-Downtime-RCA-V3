import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { CandidateView, ReconciliationView } from '@/api/v2/types/reconciliation';
import type { CodingGateView } from '@/api/v2/types/stop-coding';
import type { PeriodDetailView } from '@/api/v2/types/periods';
import { actAs } from '@/test/acting-user';
import type { WorkflowActions } from './hooks/use-workflow-actions';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { periodGridTitle, periodTitle, shiftLabel } = await import('./model/period-title');
const { verifyBlockedReason } = await import('./coding/verify-reason');
const { CodingGatePanel } = await import('./coding/coding-gate-panel');
const { StickyWorkflowBar } = await import('./workflow/sticky-workflow-bar');
const { CandidateRow } = await import('./editor/candidate-row');
const { AdjustmentForm } = await import('./adjustments/adjustment-form');
const { DispositionForm } = await import('./dispositions/disposition-form');

const VIEW = {
  periodId: 'p2', unitId: 'u1', utcStart: '2026-10-17T02:30:00.000Z', utcEnd: '2026-10-17T10:30:00.000Z', baseRunId: 'run-1', contentHash: 'h', lines: [],
  publishedRevision: null, revision: { id: 'rev', revision: 3, lifecycle: 'draft', isStale: false, submittedBy: null, submittedHash: null },
} as unknown as ReconciliationView;

const GATE = {
  mode: 'warn', target: '0.95', stops: 1, coded: 0, investigationPending: 0, uncoded: 1, codedRatio: '0', codedSeconds: '0', stoppedSeconds: '3600', passes: false,
  issues: [], verification: { verified: 0, unverified: 0, failureDetailed: 0, validated: 0, unvalidated: 0 },
} as CodingGateView;

const PERIOD = {
  id: 'p2', unitId: 'u1', utcStart: VIEW.utcStart, utcEnd: VIEW.utcEnd, localDate: '2026-10-17', shiftName: 'A', adjustments: [],
  slices: [{ id: 's1', productId: 'p1', quantityUom: 't', actuals: null }],
} as unknown as PeriodDetailView;

const candidate = (causeEventId: string | null) =>
  ({ autoKey: 'k1', sliceId: 's1', kind: 'quality', basis: 'measured', quantity: '3', effectiveQuantity: '3', state: 'proposed', causeEventId, reasonCodeId: null, impactCodeId: null, derivation: null, lossLineId: null }) as unknown as CandidateView;

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

describe('QA planning: period page wording, chips, reasons and operator links', () => {
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/form']}>
          <Where />
          <Routes>
            <Route path="/form" element={node} />
            <Route path="/back" element={<p>Back</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    actAs('SuperAdmin');
  });

  it('the period h1 names the unit, the plant-format date and the shift', () => {
    expect(periodTitle({ unitName: 'HDPE Extruder 1', localDate: '2026-10-17', shiftName: 'A' })).toBe('HDPE Extruder 1 — 2026-10-17 · Shift A');
    expect(periodTitle({ unitName: 'HDPE Extruder 1', localDate: '2026-10-17', shiftName: null })).toBe('HDPE Extruder 1 — 2026-10-17');
    expect(periodTitle({ unitName: 'U', localDate: '2026-10-17', shiftName: 'A' }, { calendar: 'persian' })).toBe('U — 1405/07/25 · Shift A');
    expect(shiftLabel('Night shift')).toBe('Night shift');
  });

  it('re-test N5: the grid page has one label, used by its h1 and by the period page back link', () => {
    expect(periodGridTitle('Extruder1 HD5502 — 17 Oct 2026')).toBe('Extruder1 HD5502 — 17 Oct 2026 · period accounting');
    expect(periodGridTitle(undefined)).toBe('Period accounting');
  });

  it('"Verify this shift\'s stops" says why it is disabled', () => {
    expect(verifyBlockedReason(GATE)).toMatch(/^Code the stop first/);
    expect(verifyBlockedReason({ ...GATE, uncoded: 2 })).toMatch(/^Code the 2 uncoded stops first/);
    expect(verifyBlockedReason({ ...GATE, uncoded: 0 })).toBe('Every coded stop of this shift is already verified.');
    expect(verifyBlockedReason({ ...GATE, uncoded: 0, verification: { ...GATE.verification, unverified: 2 } })).toBeNull();
    // re-test N8: Shift C — its only stop is uncoded and counted as waiting; the button stays disabled
    expect(verifyBlockedReason({ ...GATE, verification: { ...GATE.verification, unverified: 1 } })).toMatch(/^Code the stop first/);
    actAs('Manager');
    wrap(<CodingGatePanel view={{ ...VIEW, codingGate: GATE } as unknown as ReconciliationView} />);
    const button = screen.getByTestId('verify-shift');
    expect(button).toBeDisabled();
    expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')).toHaveTextContent(/Code the stop first/);
  });

  it('a quality line no stop caused shows no "Not coded" chip; a stop line still does', () => {
    const props = { uom: 't', saved: null, decision: null, setDraft: vi.fn(), issues: [], readOnly: true, timezone: 'UTC' };
    const first = wrap(<CandidateRow candidate={candidate(null)} {...props} />);
    expect(screen.queryByTestId('line-not-coded')).toBeNull();
    first.unmount();
    wrap(<CandidateRow candidate={{ ...candidate('e1'), kind: 'availability' }} {...props} />);
    expect(screen.getByTestId('line-not-coded')).toBeTruthy();
  });

  it('the operator gets no Review & close link in the workflow strip', () => {
    const actions = { pending: null, problem: null, recomputeState: null, submit: vi.fn() } as unknown as WorkflowActions;
    actAs('Operator');
    const first = wrap(<StickyWorkflowBar view={VIEW} actions={actions} reviewHref="/plans/plan1/periods/p2/review" unsavedLines={false} compact={false} />);
    expect(screen.queryByTestId('sticky-review-link')).toBeNull();
    first.unmount();
    actAs('Manager');
    wrap(<StickyWorkflowBar view={VIEW} actions={actions} reviewHref="/plans/plan1/periods/p2/review" unsavedLines={false} compact={false} />);
    expect(screen.getByTestId('sticky-review-link')).toBeTruthy();
  });

  it('the adjustment form marks required fields and asks before Cancel discards typed text', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    wrap(<AdjustmentForm period={PERIOD} timezone="UTC" backTo="/back" onSaved={vi.fn()} />);
    expect(screen.getByLabelText(/^Reason/).getAttribute('aria-required')).toBe('true');
    expect(screen.getByLabelText(/^Evidence/).getAttribute('aria-required')).toBe('true');
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: 'recount' } });
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/form');
  });

  it('the disposition form marks required fields and guards unsaved edits', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    wrap(<DispositionForm period={PERIOD} timezone="UTC" backTo="/back" onSaved={vi.fn()} />);
    expect(screen.getByLabelText(/^Lot number/).getAttribute('aria-required')).toBe('true');
    expect(screen.getByRole('group', { name: /Produced from/ }).textContent).toContain('*');
    fireEvent.change(screen.getByLabelText(/^Lot number/), { target: { value: 'A01' } });
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/back');
  });
});
