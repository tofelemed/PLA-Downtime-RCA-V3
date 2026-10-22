import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { UnitImpactRuleView } from '@/api/v2/types/unit-impact';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, listPage, stubV2Fetch, type V2Call } from '@/test/v2-fetch';
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
  if (path.endsWith('/units')) return jsonResponse(200, listPage([{ id: 'u1', code: 'EXT-1', name: 'Extruder 1', rowVersion: 1 }]));
  if (path.endsWith('/unit-impact-rules')) return jsonResponse(200, listPage([RULE]));
  return undefined;
}

async function fillDraft() {
  fireEvent.click(screen.getByTestId('impact-rule-new'));
  const form = await screen.findByTestId('impact-rule-form');
  await within(form).findByRole('option', { name: 'Extruder 1' });
  await waitFor(() => expect(within(form).getAllByRole('option', { name: 'P-101 — Feed pump' }).length).toBeGreaterThan(0));
  fireEvent.change(within(form).getByLabelText('Unit'), { target: { value: 'u1' } });
  fireEvent.change(screen.getByLabelText('Asset'), { target: { value: 'a1' } });
  fireEvent.change(screen.getByLabelText('Why'), { target: { value: 'one of two trains' } });
  fireEvent.change(screen.getByLabelText('Effective from date'), { target: { value: '2027-02-01' } });
}

const renderPage = (entry = '/master-data/unit-impact-rules') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[entry]}><UnitImpactRulesPage /></MemoryRouter>
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
    expect(screen.queryByTestId('impact-rule-form')).toBeNull();
    fireEvent.click(screen.getByTestId('impact-rule-new'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Add unit impact rule')).toBeInTheDocument();
    expect(within(dialog).getByTestId('impact-rule-form')).toBeInTheDocument();
  });

  it('a new draft rule ends in the result dialog and the form closes; Add another opens a fresh one', async () => {
    const calls = stubV2Fetch((call) => (call.method === 'POST' && call.url.pathname.endsWith('/unit-impact-rules') ? jsonResponse(201, { ...RULE, id: 'r2', state: 'draft', version: 2 }) : reply(call)));
    actAs('reliability_engineer');
    renderPage();
    await screen.findByRole('table', { name: 'Unit impact rules' });
    await fillDraft();
    fireEvent.click(screen.getByRole('button', { name: 'Add draft rule' }));
    const dialog = await screen.findByTestId('save-result-dialog');
    expect(within(dialog).getByText('Draft rule version 2 added')).toBeInTheDocument();
    expect(within(dialog).getByText(/Another manager approves it/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'View rule' })).toHaveAttribute('href', '/master-data/unit-impact-rules?unitId=u1#unit-impact-rule-r2');
    // the list is the page already shown: no redundant "Back to Unit impact rules"
    expect(within(dialog).queryByRole('link', { name: 'Back to Unit impact rules' })).toBeNull();
    expect(screen.queryByTestId('impact-rule-form')).toBeNull();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add another' }));
    await waitFor(() => expect(screen.queryByTestId('save-result-dialog')).toBeNull());
    expect(within(await screen.findByTestId('impact-rule-dialog')).getByTestId('impact-rule-form')).toBeInTheDocument();
    expect((screen.getByLabelText('Why') as HTMLInputElement).value).toBe('');
  });

  it('honours ?unitId=: the list is filtered on the server, 20 per page, and Add rule preselects the unit', async () => {
    const calls = stubV2Fetch(reply);
    actAs('reliability_engineer');
    renderPage('/master-data/unit-impact-rules?unitId=u1');
    await screen.findByRole('table', { name: 'Unit impact rules' });
    const listCall = calls.find((c) => c.url.pathname.endsWith('/unit-impact-rules'));
    expect(listCall?.url.searchParams.get('unitId')).toBe('u1');
    expect(listCall?.url.searchParams.get('limit')).toBe('20');
    expect(screen.queryByRole('button', { name: /Load more/ })).toBeNull();
    fireEvent.click(screen.getByTestId('impact-rule-new'));
    const form = await screen.findByTestId('impact-rule-form');
    await within(form).findByRole('option', { name: 'Extruder 1' });
    expect((within(form).getByLabelText('Unit') as HTMLSelectElement).value).toBe('u1');
  });

  it('without a unit in the address every unit is listed and the form starts empty', async () => {
    const calls = stubV2Fetch(reply);
    actAs('reliability_engineer');
    renderPage();
    await screen.findByRole('table', { name: 'Unit impact rules' });
    expect(calls.find((c) => c.url.pathname.endsWith('/unit-impact-rules'))?.url.searchParams.has('unitId')).toBe(false);
    fireEvent.click(screen.getByTestId('impact-rule-new'));
    const form = await screen.findByTestId('impact-rule-form');
    expect((within(form).getByLabelText('Unit') as HTMLSelectElement).value).toBe('');
  });

  it('a refused draft is one red alert at the top of the form with the overlapping versions; the input stays', async () => {
    const overlap = errorBody('VERSION_OVERLAP', 'The rule overlaps an approved version', {
      conflicts: [{ id: 'r1', version: 1, effectiveFrom: '2027-01-01T00:00:00.000Z', effectiveTo: null }],
    });
    stubV2Fetch((call) => (call.method === 'POST' && call.url.pathname.endsWith('/unit-impact-rules') ? jsonResponse(409, overlap) : reply(call)));
    actAs('reliability_engineer');
    renderPage();
    await screen.findByRole('table', { name: 'Unit impact rules' });
    await fillDraft();
    fireEvent.click(screen.getByRole('button', { name: 'Add draft rule' }));
    const form = screen.getByTestId('impact-rule-form');
    expect(await within(form).findByTestId('save-failure-alert')).toBeInTheDocument();
    expect(within(form).getByTestId('impact-rule-conflicts')).toHaveTextContent('Version 1');
    expect((within(form).getByLabelText('Why') as HTMLInputElement).value).toBe('one of two trains');
    expect(screen.queryByTestId('save-result-dialog')).toBeNull();
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
