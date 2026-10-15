import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { UnitImpactRuleView } from '@/api/v2/types/unit-impact';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';
import { impactRuleCreateBody, validateImpactRuleForm, emptyImpactRuleForm } from './impact-rule-form-model';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { UnitImpactRulesPage } = await import('./unit-impact-rules-page');

const PUMP = { id: 'a1', code: 'P-101', name: 'Feed pump', unitId: 'u1', assetType: 'Pump', retiredAt: null, rowVersion: 1 };
const SPARE = { id: 'a2', code: 'P-101B', name: 'Spare feed pump', unitId: 'u1', assetType: 'Pump', retiredAt: null, rowVersion: 1 };
const RULE: UnitImpactRuleView = {
  id: 'r1', unitId: 'u1', assetId: 'a1', mode: 'fractional', fraction: '0.5', standbyAssetId: 'a2', takeoverSeconds: 60, reason: 'one of two trains',
  version: 1, state: 'approved', effectiveFrom: '2027-01-01T00:00:00.000Z', effectiveTo: null, createdBy: 'someone', approvedBy: 'manager', approvedAt: '2027-01-01T00:00:00.000Z',
  rowVersion: 1, createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
};

function reply(call: V2Call) {
  const path = call.url.pathname;
  if (path.endsWith('/assets')) return jsonResponse(200, listPage([PUMP, SPARE]));
  if (path.endsWith('/unit-impact-rules')) return jsonResponse(200, listPage([RULE]));
  return undefined;
}

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter><UnitImpactRulesPage /></MemoryRouter>
    </QueryClientProvider>,
  );

describe('Unit impact rules page (plan 1.10, SME Q5 + D9)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('lists a rule with its share lost and the standby that takes over; a reliability engineer may add one', async () => {
    stubV2Fetch(reply);
    actAs('reliability_engineer');
    renderPage();
    const table = await screen.findByRole('table', { name: 'Unit impact rules' });
    expect(await within(table).findByText('Partial: 50 % of the rate')).toBeInTheDocument();
    expect(within(table).getByText(/P-101B — Spare feed pump \(within 60 s\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('impact-rule-new'));
    expect(screen.getByTestId('impact-rule-form')).toBeInTheDocument();
  });

  it('the form checks the shape the server validates and sends the share as a 0..1 decimal', () => {
    const values = { ...emptyImpactRuleForm(), unitId: 'u1', assetId: 'a1', mode: 'fractional' as const, percent: '50', reason: 'one of two trains', effectiveFrom: '2027-01-01T00:00' };
    expect(validateImpactRuleForm({ ...values, percent: '150', standbyAssetId: 'a1' }, 'Asia/Tehran')).toMatchObject({
      fraction: 'Enter the share lost, above 0 and at most 100 %',
      standbyAssetId: 'The standby is another asset',
    });
    expect(validateImpactRuleForm(values, 'Asia/Tehran')).toEqual({});
    expect(impactRuleCreateBody(values, 'Asia/Tehran')).toMatchObject({ mode: 'fractional', fraction: '0.5', standbyAssetId: null, takeoverSeconds: 60 });
  });
});
