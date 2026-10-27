import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { PeriodSummaryView } from '@/api/v2/types/period-overview';
import type { CandidateDerivationView, CandidateView, ReconciliationView, SliceReconciliationView } from '@/api/v2/types/reconciliation';
import type { CodingGateView } from '@/api/v2/types/stop-coding';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { periodGridColumns } = await import('./components/period-grid-columns');
const { gridNote } = await import('./model/grid-notes');
const { listRegime, periodRegime } = await import('./model/period-regime');
const { CandidateRow } = await import('./editor/candidate-row');
const { ReconciliationSummary } = await import('./components/reconciliation-summary');
const { CodingGatePanel } = await import('./coding/coding-gate-panel');
const { DayCodingGate } = await import('./day/day-coding-gate');
const { FLAG_LABELS } = await import('./model/display');
const { declaredShortfallOf, isDataFlag, stopsCrossCheckOf } = await import('./model/candidate-derivation');
const { gateVerdictText, gateWording } = await import('./model/coding-gate-text');
const { issueText } = await import('./model/problem-text');

type Pref = Parameters<typeof periodGridColumns>[1];
const PREF = { calendar: 'gregorian', digits: 'latn', dateFormat: 'iso' } as unknown as Pref;

const ROW = {
  periodId: 'p1', unitId: 'u1', utcStart: '2026-10-25T20:30:00.000Z', utcEnd: '2026-10-26T20:30:00.000Z', localDate: '2026-10-26', shiftName: 'Day A',
  stateReadiness: 'ready', workflowState: 'draft', plan: null, coverageRatio: null, qualityStates: [], sla: null, run: null,
} as unknown as PeriodSummaryView;

const columnsOf = (isDay: boolean, isDeclared: boolean) => periodGridColumns('Asia/Tehran', PREF, { isDay, isDeclared });

const wrap = (node: ReactNode) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{node}</QueryClientProvider>
    </MemoryRouter>,
  );

describe('period grid in declared mode', () => {
  it('the Inputs column reads Declared (OT) only when the plant accounts declared losses', () => {
    const declared = columnsOf(true, true).map((column) => column.header);
    expect(declared).toContain('Declared (OT)');
    expect(declared).not.toContain('Inputs');
    expect(columnsOf(false, false).map((column) => column.header)).toContain('Inputs');
  });

  it('the Period cell follows the row grain: "Day" for a whole-day period, the shift name otherwise', () => {
    const cellOf = (row: PeriodSummaryView) => render(<>{columnsOf(true, true).find((c) => c.id === 'period')?.cell(row, 0)}</>).container.textContent;
    expect(cellOf({ ...ROW, isDayGrain: true })).toContain('2026-10-26 · Day');
    expect(cellOf({ ...ROW, isDayGrain: false })).toContain('Day A');
  });

  it('one list shows A/B/C for the computed shift periods and Day for the declared day; the header follows every row', () => {
    const shift = (name: string): PeriodSummaryView => ({ ...ROW, periodId: name, localDate: '2026-10-25', shiftName: name, isDayGrain: false, lossBasis: 'computed' });
    const rows = [shift('A'), shift('B'), shift('C'), { ...ROW, periodId: 'd', shiftName: 'Day', isDayGrain: true, lossBasis: 'declared' as const }];
    const inForce = { isDay: true, isDeclared: true };
    const mode = listRegime(rows, inForce);
    const period = periodGridColumns('Asia/Tehran', PREF, mode).find((c) => c.id === 'period');
    const texts = rows.map((row) => render(<>{period?.cell(row, 0)}</>).container.textContent ?? '');
    expect(texts.slice(0, 3).map((t) => t.split(' · ')[1]?.slice(0, 1))).toEqual(['A', 'B', 'C']);
    expect(texts[3]).toContain('2026-10-26 · Day');
    expect(mode).toEqual({ isDay: false, isDeclared: false });
    expect(periodGridColumns('Asia/Tehran', PREF, mode).map((c) => c.header)).toContain('Inputs');
  });

  it('a period without a run reads the policy in force; a run reads its own basis', () => {
    const inForce = { isDay: true, isDeclared: true };
    expect(periodRegime({ isDayGrain: true, lossBasis: null }, inForce)).toEqual({ isDay: true, isDeclared: true });
    expect(periodRegime({ isDayGrain: false, lossBasis: 'computed' }, inForce)).toEqual({ isDay: false, isDeclared: false });
  });

  it('the note under the grid follows the mode', () => {
    expect(gridNote({ isDay: false, isDeclared: false })).toMatch(/^Plan ledger\. Attributed/);
    expect(gridNote({ isDay: true, isDeclared: true })).toContain('declared');
    expect(gridNote({ isDay: true, isDeclared: true })).toContain('one plant day');
  });
});

const DECLARED_DERIVATION: CandidateDerivationView = {
  basis: 'declared', ledger: 'plan', segmentStart: '2026-10-25T20:30:00.000Z', segmentEnd: '2026-10-26T20:30:00.000Z', durationSeconds: 86400,
  rate: null, rateScaledToTarget: false, sourceEventId: 'event-1', occurrenceId: null,
  evidence: [{ eventId: 'event-1', eventRevisionId: null, occurrenceId: null, share: '0.25', clippedStart: '2026-10-25T20:30:00.000Z', clippedEnd: '2026-10-26T20:30:00.000Z' }],
  flags: ['declared_shortfall:32', 'stops_cross_check:30:t'],
};
const DECLARED_CANDIDATE: CandidateView = { lossLineId: 'l1', autoKey: 'k1', sliceId: 's1', kind: 'availability', quantity: '8', basis: 'declared', reasonCodeId: null, impactCodeId: null, causeEventId: 'event-1', state: 'proposed', effectiveQuantity: '8', derivation: DECLARED_DERIVATION };

describe('declared candidate and slice', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    actAs('Manager', 'user-me');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('labels the candidate as declared from the production loss event and derives it without rate rows', () => {
    wrap(<CandidateRow candidate={DECLARED_CANDIDATE} uom="t" saved={null} decision={null} setDraft={() => undefined} issues={[]} readOnly timezone="Asia/Tehran" />);
    expect(screen.getByTestId('candidate-row')).toHaveTextContent('Declared · from production loss event');
    fireEvent.click(screen.getByText('How was this calculated?'));
    const declared = screen.getByTestId('derivation-declared');
    expect(screen.getByTestId('derivation-shortfall')).toHaveTextContent('32.00 t declared by OT');
    expect(screen.getByTestId('derivation-share')).toHaveTextContent('25.0 % of the shortfall');
    expect(declared).toHaveTextContent('Quantity');
    expect(screen.getByTestId('derivation-stops-cross-check')).toHaveTextContent('30.00 t recorded in stops');
    expect(declared).not.toHaveTextContent('Rate');
    expect(screen.queryByTestId('derivation-flag')).toBeNull();
  });

  it('reads the shortfall and the cross-check from the flag values, which are data not labels', () => {
    expect(declaredShortfallOf(['x', 'declared_shortfall:12.5'])).toBe('12.5');
    expect(declaredShortfallOf(['x'])).toBeNull();
    expect(stopsCrossCheckOf(['stops_cross_check:7:t'])).toEqual({ quantity: '7', uom: 't' });
    expect(stopsCrossCheckOf(['declared_loss_missing'])).toBeNull();
    expect(isDataFlag('declared_shortfall:1')).toBe(true);
    expect(isDataFlag('declared_loss_chosen:e1')).toBe(true);
    expect(isDataFlag('capacity_not_applicable')).toBe(false);
  });

  it('says the new slice flags in plain words', () => {
    expect(FLAG_LABELS.declared_loss_missing).toBe('OT has not sent this day’s production loss');
    expect(FLAG_LABELS.declared_identity_mismatch).toBe('Planned − actual ≠ shortfall (review)');
    expect(FLAG_LABELS.declared_actual_missing).toBe('OT actual missing — measured good used');
    expect(FLAG_LABELS.capacity_not_applicable).toBe('Capacity figures not available (declared basis)');
    expect(FLAG_LABELS.duplicate_declared_loss).toBe('Two production loss events cover this period');
    expect(FLAG_LABELS.declared_single_slice).toBe('Several product slices — the declared figure is booked to the first');
  });

  it('the period summary shows declared flags as words and the stops cross-check as its own line', () => {
    const slice = { sliceId: 's1', uom: 't', target: '240', actual: '208', gap: '32', attributed: '8', toleranceAdjustment: '0', residual: '24', overAccounted: '0', overproduction: '0', tolerance: '1', flags: ['capacity_not_applicable', 'stops_cross_check:30:t'] } as unknown as SliceReconciliationView;
    wrap(<ReconciliationSummary view={{ slices: [slice] } as unknown as ReconciliationView} />);
    expect(screen.getByText(/Status: Capacity figures not available \(declared basis\)$/)).toBeInTheDocument();
    expect(screen.getByTestId('stops-cross-check')).toHaveTextContent('Stops cross-check');
    expect(screen.queryByTestId('figure-declaredGain')).not.toBeInTheDocument();
  });

  it('the Checks row shows the declared recovery the reconciliation took off (23 + 11 + 6 − 8)', () => {
    const slice = { sliceId: 's1', uom: 't', target: '240', actual: '208', gap: '32', attributed: '32', declaredGain: '8', toleranceAdjustment: '0', residual: '0', overAccounted: '0', overproduction: '0', tolerance: '1', flags: [] } as unknown as SliceReconciliationView;
    wrap(<ReconciliationSummary view={{ slices: [slice] } as unknown as ReconciliationView} />);
    expect(screen.getByTestId('figure-declaredGain')).toHaveTextContent(/^Recovery−8\.000\s?t$/);
    expect(screen.getByTestId('figure-overAccounted')).toHaveAttribute('data-value', '0');
  });
});

const GATE: CodingGateView = {
  mode: 'block', target: '1', stops: 1, coded: 0, investigationPending: 0, uncoded: 1, codedRatio: '0', codedSeconds: null, stoppedSeconds: null, passes: false,
  issues: [{ code: 'LOSS_EVENT_UNCODED', message: 'x', sliceId: null }], verification: { verified: 0, unverified: 1, failureDetailed: 0, validated: 0, unvalidated: 0 },
};
const view = (gate: CodingGateView) => ({ periodId: 'p1', unitId: 'u1', utcStart: '2026-10-25T20:30:00.000Z', utcEnd: '2026-10-26T20:30:00.000Z', codingGate: gate }) as unknown as ReconciliationView;

describe('coding gate in declared mode', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
    actAs('production_engineer');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('words the verdict, the missing reason, the unit and the verify button for production losses', () => {
    wrap(<CodingGatePanel view={view(GATE)} declared />);
    const panel = screen.getByTestId('coding-gate');
    expect(panel).toHaveTextContent('Production loss coding incomplete — submission is blocked');
    expect(panel).toHaveTextContent('1 loss event: 0 with a reason');
    expect(panel).toHaveTextContent('coded share of the shortfall 0 %');
    const link = screen.getByTestId('coding-gate-uncoded-link');
    expect(link).toHaveTextContent('The day’s loss event has no reason');
    expect(new URL(link.getAttribute('href') ?? '', 'http://t').searchParams.get('kinds')).toBe('production_loss');
    expect(screen.getByRole('button', { name: 'Verify this day’s loss coding' })).toBeInTheDocument();
  });

  it('the text model switches between stop and production loss wording', () => {
    expect(gateVerdictText({ passes: true, mode: 'warn' }, true)).toBe('Production loss coding complete');
    expect(gateVerdictText({ passes: true, mode: 'warn' }, false)).toBe('Stop coding complete');
    expect(gateWording(true).unit.many).toBe('loss events');
  });

  it('the day gate reads production loss coding in declared mode', () => {
    wrap(<DayCodingGate gate={{ ...GATE, mode: 'warn' }} declared />);
    expect(screen.getByTestId('day-coding-gate')).toHaveTextContent('Production loss coding incomplete — shown as a warning');
  });
});

describe('declared gate and error codes in the submit / approve error UI', () => {
  it.each(['DECLARED_LOSS_MISSING', 'DECLARED_IDENTITY_MISMATCH', 'DECLARED_DUPLICATE', 'LOSS_EVENT_UNCODED', 'DECLARED_NOT_CONFIRMED'])('%s renders as plain words, never the code', (code) => {
    const text = issueText({ code, message: null });
    expect(text.length).toBeGreaterThan(20);
    expect(text).not.toContain(code);
  });
});
