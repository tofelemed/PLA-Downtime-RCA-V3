import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { LossTreeGroupView, LossTreeView } from '@/api/v2/types/pla-analytics';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { exportBlockedReason, parseScope } = await import('./model/analytics-scope');
const { eventLossesOf } = await import('./model/event-losses');
const { coverageText, inSentence, valueText } = await import('./model/display');
const { lossLinesNote, revisionSelectionLabel } = await import('./model/links');
const { periodLabel } = await import('./model/period-label');
const { SnapshotStatus } = await import('./components/snapshot-status');
const { LossTable } = await import('./components/loss-table');
const { ScopeExport } = await import('./components/scope-export');

const SCOPE = parseScope(new URLSearchParams('from=2026-10-17T02:30:00.000Z&to=2026-10-18T02:30:00.000Z'), 0);
const GREGORIAN = { calendar: 'gregorian', digits: 'latin' } as const;
const wrap = (node: ReactNode) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
const group = (over: Partial<LossTreeGroupView>): LossTreeGroupView => ({ key: null, label: null, unit: 't', amount: '1', share: '1', cumulativeShare: '1', lines: 1, eventLines: 0, status: 'quantity', fxProvisional: false, reasons: [], ...over });

describe('QA PLA fixes', () => {
  it('M2: the loss events list reads the attributed loss of each event from the loss lines (per unit, never the event quantity)', () => {
    const view = { groups: [group({ key: 'e1', amount: '28' }), group({ key: 'e2', amount: '14' }), group({ key: null, amount: '9' })] } as LossTreeView;
    const losses = eventLossesOf(view);
    expect(losses.get('e1')).toEqual([{ amount: '28', uom: 't' }]);
    expect(losses.get('e2')).toEqual([{ amount: '14', uom: 't' }]);
    expect(losses.size).toBe(2);
  });

  it('the "Quality (dispositions)" group is its own row, separate from "Not coded"; a manual-only reason says why it has no link', () => {
    wrap(
      <LossTable
        groups={[group({ key: 'quality_dispositions', label: 'Quality (dispositions)', amount: '5' }), group({ key: null, amount: '14', eventLines: 1 }), group({ key: 'r9', label: 'SPEED-LOSS', amount: '4' })]}
        total={{ unit: 't', amount: '23', lines: 3, groups: 3, status: 'quantity', fxProvisional: false, reasons: [] }}
        metric="qty"
        groupTitle="Reason"
        testId="t"
        noLinkReason={() => 'Manual loss lines with no event: nothing to open'}
      />,
    );
    const rows = screen.getAllByTestId('loss-group');
    expect(rows.map((row) => row.firstChild?.textContent)).toEqual(['Quality (dispositions)', 'Not coded', 'SPEED-LOSS']);
    expect(within(rows[2]).getByTestId('loss-group-no-link')).toHaveTextContent('no event');
    expect(screen.getByTestId('loss-total')).toHaveTextContent('Total (3 groups, 3 lines)');
  });

  it('lows: plurals, acronyms keep their case, period labels without nested brackets', () => {
    wrap(<LossTable groups={[group({ key: 'r1', label: 'R' })]} total={{ unit: 't', amount: '1', lines: 1, groups: 1, status: 'quantity', fxProvisional: false, reasons: [] }} metric="qty" groupTitle="Reason" testId="t" />);
    expect(screen.getByTestId('loss-total')).toHaveTextContent('Total (1 group, 1 line)');
    expect(inSentence('OEE component')).toBe('OEE component');
    expect(inSentence('Reason')).toBe('reason');
    expect(periodLabel({ localDate: '2026-10-17', shiftName: 'C', utcStart: '2026-10-17T18:30:00.000Z' }, 'Asia/Tehran', GREGORIAN)).toBe('2026-10-17 C · 22:00');
  });

  it('cost views without an input say "Not valued" with the reason, never a bare "—"', () => {
    expect(valueText({ currency: 'USD', amount: null, nativeAmount: '0', status: 'unvalued', reasons: ['rate_missing'] })).toBe('Not valued in USD (No approved valuation rate)');
    expect(valueText({ currency: 'USD', amount: '7650', nativeAmount: '7650', status: 'valued', reasons: [] })).toBe('7,650.00 USD');
  });

  it('Reports: one wording for the revision selection; captions and coverage follow it (43 % approved vs 86 % calculated)', () => {
    expect(revisionSelectionLabel(true)).toBe('Approved revisions only');
    expect(lossLinesNote(true)).not.toMatch(/draft/);
    expect(lossLinesNote(false)).toMatch(/else the open draft/);
    expect(coverageText('43 %', true)).toBe('43 % of periods approved');
    expect(coverageText('86 %', false)).toBe('86 % of periods calculated');
    const response = { data: { calculationRunIds: ['r1'] }, calculationRunId: 'r1', policyVersion: null, dataQuality: { missingCount: 4, provisionalCount: 0, notes: [] }, coverage: { from: SCOPE.from, to: SCOPE.to, ratio: 3 / 7 }, isProvisional: true, asOf: SCOPE.to, scope: { tenantId: 'tenant-a' } } as AnalyticsResponse<{ calculationRunIds: string[] }>;
    render(<SnapshotStatus scopeLabel="HDPE" timezone="UTC" timezoneIsFallback={false} response={response} approvedOnly />);
    expect(screen.getByTestId('snapshot-incomplete')).toHaveTextContent('only approved periods are counted (43 % of periods approved)');
    expect(screen.queryByText('Provisional')).toBeNull();
  });

  it('exports say why they are disabled, in words', () => {
    expect(exportBlockedReason({ ...SCOPE, approvedOnly: false }, false, 'Approved only')).toMatch(/choose “Approved only” first/);
    expect(exportBlockedReason({ ...SCOPE, approvedOnly: true }, true, 'Approved only')).toMatch(/not approved yet/);
    expect(exportBlockedReason({ ...SCOPE, approvedOnly: true }, false, 'Approved only')).toBeNull();
    wrap(<ScopeExport request={null} disabledReason="Some periods of these dates are not approved yet." label="Loss lines" timezone="UTC" testId="x" />);
    const button = screen.getByTestId('x-start');
    expect(button).toBeDisabled();
    expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')).toHaveTextContent('not approved yet');
  });
});
