import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { CandidateDerivationView, CandidateView, MonthCloseStateView, ReconciliationView } from '@/api/v2/types/reconciliation';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CandidateRow } = await import('./editor/candidate-row');
const { MonthLockBanner } = await import('./components/month-lock-banner');
const { WorkflowBar } = await import('./workflow/workflow-bar');
const { ReviewCorrection } = await import('./workflow/review-correction');
const { PeriodGrid } = await import('./components/period-grid');
const { derivationFlagLabel, effectiveDiffers, shareAsPercent } = await import('./model/candidate-derivation');
const { allowsDirectRevision, correctionDialogText, monthLockKind, proposalPathOpen } = await import('./model/month-lock');

const DERIVATION: CandidateDerivationView = {
  basis: 'planning_rate', ledger: 'plan', segmentStart: '2026-10-08T06:00:00.000Z', segmentEnd: '2026-10-08T07:30:00.000Z', durationSeconds: 5400,
  rate: { versionId: 'rate-1', kind: 'planning', value: '12.5', timebase: 'h' }, rateScaledToTarget: false, sourceEventId: 'event-1', occurrenceId: null,
  evidence: [{ eventId: 'event-1', eventRevisionId: null, occurrenceId: null, share: '0.125', clippedStart: '2026-10-08T06:00:00.000Z', clippedEnd: '2026-10-08T07:00:00.000Z' }],
  flags: ['upstream_starvation', 'origin_unit:7f6e'],
};
const CANDIDATE: CandidateView = { lossLineId: 'l1', autoKey: 'k1', sliceId: 's1', kind: 'availability', quantity: '18.75', basis: 'planning_rate', reasonCodeId: null, impactCodeId: null, causeEventId: 'event-1', state: 'adjusted', effectiveQuantity: '10', derivation: DERIVATION };
const APPROVED = {
  periodId: 'p2', unitId: 'u1', utcStart: '2026-10-08T06:00:00.000Z', utcEnd: '2026-10-08T14:00:00.000Z', baseRunId: 'run-1', contentHash: 'h', lines: [], publishedRevision: 2, openProposalId: null,
  revision: { id: 'rev', revision: 2, lifecycle: 'approved', isStale: false, submittedBy: null, submittedHash: null },
} as unknown as ReconciliationView;
const close = (state: MonthCloseStateView['state'], correctionPath: MonthCloseStateView['correctionPath']): MonthCloseStateView => ({ state, monthKey: '2026-10', correctionPath });

describe('candidate derivation and month lock (UX D-2, D-7)', () => {
  let urls: URL[];
  let pages: Record<string, { items: unknown[]; nextCursor: string | null }>;
  const wrap = (node: ReactNode, path = '/plans/plan1') =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={node} /></Routes></MemoryRouter></QueryClientProvider>);

  beforeEach(() => {
    urls = [];
    pages = {};
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(url);
      urls.push(parsed);
      const page = pages[parsed.searchParams.get('cursor') ?? ''] ?? { items: [], nextCursor: null };
      return new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    actAs('Manager', 'user-me');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('formats server shares and flags as text without arithmetic on the quantities', () => {
    expect(shareAsPercent('0.125')).toBe('12.5');
    expect(shareAsPercent('1')).toBe('100');
    expect(shareAsPercent('0.5')).toBe('50');
    expect(shareAsPercent('0.00375')).toBe('0.375');
    expect(shareAsPercent('abc')).toBeNull();
    expect(derivationFlagLabel('origin_unit:7f6e')).not.toContain('7f6e');
    expect(effectiveDiffers({ quantity: '10', effectiveQuantity: '10' })).toBe(false);
    expect(effectiveDiffers({ quantity: '10', effectiveQuantity: '4' })).toBe(true);
  });

  it('a candidate explains basis, window, rate, source event, evidence shares and flags behind a disclosure', () => {
    wrap(<CandidateRow candidate={CANDIDATE} uom="t" saved={null} decision={null} setDraft={() => undefined} issues={[]} readOnly timezone="UTC" />);
    expect(screen.getByTestId('candidate-effective')).toHaveTextContent('10');
    const box = screen.getByTestId('candidate-derivation');
    expect(within(box).getByText('How was this calculated?')).toBeInTheDocument();
    expect(within(box).getByTestId('derivation-basis')).toHaveTextContent('Plan ledger');
    expect(within(box).getByTestId('derivation-rate')).toHaveTextContent('12.50 t/h');
    expect(box).toHaveTextContent('1 h 30 min');
    expect(within(box).getByTestId('derivation-evidence')).toHaveTextContent('12.5 % share');
    expect(within(box).getAllByTestId('event-link')[0]).toHaveAttribute('href', '/events/event-1');
    expect(within(box).getAllByTestId('derivation-flag')).toHaveLength(2);
  });

  it('a rate scaled to the target says the applied rate is not stored and shows no rate value', () => {
    const scaled = { ...CANDIDATE, effectiveQuantity: '18.75', derivation: { ...DERIVATION, rateScaledToTarget: true } };
    wrap(<CandidateRow candidate={scaled} uom="t" saved={null} decision={null} setDraft={() => undefined} issues={[]} readOnly timezone="UTC" />);
    expect(screen.getByTestId('derivation-rate-scaled')).toHaveTextContent('rate scaled to target — the applied rate is not stored');
    expect(screen.queryByTestId('derivation-rate')).toBeNull();
    expect(screen.queryByTestId('candidate-effective')).toBeNull();
  });

  it('banners a locked or closing month and hides "Reopen for revision…" unless the correction is direct', () => {
    expect(monthLockKind(close('open', 'direct'))).toBeNull();
    expect(monthLockKind(close('finance_signed_off', 'none'))).toBe('closing');
    expect(allowsDirectRevision({})).toBe(true);
    expect(allowsDirectRevision({ monthClose: close('locked', 'proposal') })).toBe(false);
    const banner = wrap(<MonthLockBanner monthClose={close('locked', 'proposal')} />);
    expect(screen.getByTestId('month-lock-banner')).toHaveTextContent('Month October 2026 is locked');
    banner.unmount();
    const closing = wrap(<MonthLockBanner monthClose={close('quantities_closed', 'none')} />);
    expect(screen.getByTestId('month-lock-banner')).toHaveTextContent('Month October 2026 is closing');
    closing.unmount();
    const locked = wrap(<WorkflowBar view={{ ...APPROVED, monthClose: close('locked', 'proposal') }} shown="current" onShowCurrent={() => undefined} />);
    expect(screen.queryByTestId('wf-revise')).toBeNull();
    locked.unmount();
    wrap(<WorkflowBar view={{ ...APPROVED, monthClose: close('open', 'direct') }} shown="current" onShowCurrent={() => undefined} />);
    expect(screen.getByTestId('wf-revise')).toBeInTheDocument();
  });

  it('QA re-test: the correction dialog text follows the month state and the role', () => {
    expect(correctionDialogText(close('locked', 'proposal'), false)).toMatch(/^The month is locked/);
    expect(correctionDialogText(close('quantities_closed', 'none'), false)).toMatch(/^The month is closing/);
    expect(correctionDialogText(close('locked', 'proposal'), false)).not.toContain('SuperAdmin');
    expect(correctionDialogText(close('locked', 'proposal'), true)).toContain('As SuperAdmin you may also decide your own proposal.');
    expect(proposalPathOpen({ monthClose: close('open', 'direct') })).toBe(false);
    expect(proposalPathOpen({ monthClose: close('locked', 'proposal') })).toBe(true);
    expect(proposalPathOpen({})).toBe(true);
  });

  it('Review & close offers "Propose a correction…" in a locked month and explains the pause in a closing one', async () => {
    actAs('production_accountant', 'accountant');
    const locked = wrap(<ReviewCorrection view={{ ...APPROVED, monthClose: close('locked', 'proposal') }} />);
    fireEvent.click(screen.getByTestId('propose-correction'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    locked.unmount();
    const paused = wrap(<ReviewCorrection view={{ ...APPROVED, monthClose: close('finance_signed_off', 'none') }} />);
    expect(screen.getByTestId('correction-paused')).toHaveTextContent('Corrections are paused while the month is closing');
    expect(screen.queryByTestId('propose-correction')).toBeNull();
    paused.unmount();
    const { container } = wrap(<ReviewCorrection view={{ ...APPROVED, monthClose: close('open', 'direct') }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('the grid "Unaccounted only" filter is in the URL and keeps paging past a short filtered page (D-5)', async () => {
    const row = (periodId: string) => ({ periodId, unitId: 'u1', utcStart: '2026-10-08T06:00:00.000Z', utcEnd: '2026-10-08T14:00:00.000Z', localDate: '2026-10-08', shiftName: 'Day', workflowState: 'draft', revision: null, plan: null, sla: null, qualityStates: [], productIds: [], coverageRatio: null, isExcluded: false });
    pages = { '': { items: [row('p1')], nextCursor: 'c1' }, c1: { items: [row('p2')], nextCursor: null } };
    wrap(<PeriodGrid unitId="u1" from="2026-10-01T00:00:00.000Z" to="2026-11-01T00:00:00.000Z" timezone="UTC" onOpen={() => undefined} />, '/plans/plan1?residual=unaccounted');
    await waitFor(() => expect(screen.getAllByTestId('period-row')).toHaveLength(2));
    expect(urls[0].searchParams.getAll('residualStates')).toEqual(['unaccounted']);
    expect(urls).toHaveLength(2);
    expect(screen.getByTestId('grid-residual')).toHaveValue('unaccounted');
  });
});
