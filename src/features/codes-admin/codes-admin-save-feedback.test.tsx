import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { CodeDetailView } from '@/api/v2/types/codes-admin';
import type { RulesSchemaView, RuleView } from '@/api/v2/types/rules';
import { actAs } from '@/test/acting-user';
import { errorBody, jsonResponse, stubV2Fetch, type V2Call } from '@/test/v2-fetch';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CodeCreateDialog } = await import('./codes/code-create-dialog');
const { CodeEditor } = await import('./codes/code-editor');
const { CodeRetireAction } = await import('./codes/code-retire-action');
const { RuleEditor } = await import('./rules/rule-editor');
const { RuleActions } = await import('./rules/rule-actions');

const CODE: CodeDetailView = {
  id: 'r1', library: 'reason', code: 'MECH', name: 'Mechanical', description: null, parentId: null, path: 'r1', level: 0, version: 1, rowVersion: 1,
  effectiveFrom: null, effectiveTo: null, active: true,
};
const SCHEMA: RulesSchemaView = {
  grammarVersion: 1,
  schemaId: 'x',
  limits: { maxConditions: 20, maxDepth: 2, maxActions: 10, maxListValues: 50, maxGlobLength: 100, stepBudget: 10000 },
  operators: [{ op: 'eq', label: 'equals', value: 'single' }],
  fields: [{ name: 'physicalType', label: 'Physical type', type: 'enum', values: ['downtime'], operators: ['eq'] }],
  kinds: [{ kind: 'coding_default', label: 'Coding default', sets: [{ field: 'scheduleClass', label: 'Schedule class', values: ['unplanned'] }], flags: false, appliedBy: 'v2 create' }],
};
const RULE: RuleView = {
  id: 'rule-1', kind: 'coding_default', name: 'Long stops', description: null, priority: 0, state: 'draft', activeVersion: null, activeDefinition: null,
  draft: { definition: { when: { all: [] }, then: [] }, authorId: 'author-1', updatedAt: null }, appliedBy: 'v2 create', rowVersion: 1, createdAt: '', createdBy: 'author-1', retiredAt: null,
};

type Reply = (call: V2Call) => Response | undefined;

describe('codes & rules save feedback (DECISIONS 2026-10-22)', () => {
  let reply: Reply;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    actAs('SuperAdmin');
    toast.mockReset();
    reply = () => undefined;
    stubV2Fetch((call) => reply(call));
  });
  afterEach(() => vi.unstubAllGlobals());

  const fillNewCode = () => {
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'ELEC' } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Electrical' } });
    fireEvent.click(screen.getByTestId('code-create-submit'));
  };

  it('a new code ends in the result dialog (View code · Back to the library), the form dialog closed', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(201, { ...CODE, id: 'r9', code: 'ELEC', name: 'Electrical' }) : undefined);
    const onClose = vi.fn();
    wrap(<CodeCreateDialog library="reason-codes" parentId={null} onClose={onClose} />);
    fillNewCode();
    const result = await screen.findByTestId('save-result-dialog');
    expect(within(result).getByText('Reason code created')).toBeTruthy();
    expect(within(result).getByText('Electrical (ELEC)')).toBeTruthy();
    expect(within(result).getByRole('link', { name: 'View code' }).getAttribute('href')).toBe('/master-data/codes-rules/reason-codes/r9');
    expect(screen.queryByTestId('code-create-dialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(result).getByRole('link', { name: 'Back to Code libraries' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Add another" brings back an empty create form instead of closing', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(201, { ...CODE, id: 'r9', code: 'ELEC', name: 'Electrical' }) : undefined);
    const onClose = vi.fn();
    wrap(<CodeCreateDialog library="reason-codes" parentId={null} onClose={onClose} />);
    fillNewCode();
    fireEvent.click(within(await screen.findByTestId('save-result-dialog')).getByRole('button', { name: 'Add another' }));
    expect(await screen.findByTestId('code-create-dialog')).toBeTruthy();
    expect((screen.getByLabelText(/^Code/) as HTMLInputElement).value).toBe('');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a refused create is the red alert inside the dialog, the input kept, no toast', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(409, errorBody('CODE_EXISTS', 'exists')) : undefined);
    wrap(<CodeCreateDialog library="reason-codes" parentId={null} onClose={vi.fn()} />);
    fillNewCode();
    const dialog = screen.getByTestId('code-create-dialog');
    const alert = await within(dialog).findByTestId('save-failure-alert');
    expect(within(alert).getByTestId('admin-refusal')).toHaveAttribute('data-code', 'CODE_EXISTS');
    expect((screen.getByLabelText(/^Code/) as HTMLInputElement).value).toBe('ELEC');
    expect(screen.queryByTestId('save-result-dialog')).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });

  it('a code edit ends in a toast; Cancel goes back to the library list', async () => {
    reply = (call) => (call.method === 'PUT' ? jsonResponse(200, { ...CODE, name: 'Mech', version: 2, rowVersion: 2 }) : undefined);
    wrap(<CodeEditor library="reason-codes" code={CODE} />);
    expect(screen.getByTestId('code-cancel').getAttribute('href')).toBe('/master-data/codes-rules?library=reason-codes');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mech' } });
    fireEvent.click(screen.getByTestId('code-save'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'MECH saved as version 2' }));
    expect(screen.queryByTestId('save-failure-alert')).toBeNull();
  });

  it('a refused code edit is the red alert at the top of the editor, the input kept', async () => {
    reply = (call) => (call.method === 'PUT' ? jsonResponse(412, errorBody('STALE_REVISION', 'stale')) : undefined);
    wrap(<CodeEditor library="reason-codes" code={CODE} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mech' } });
    fireEvent.click(screen.getByTestId('code-save'));
    const alert = await screen.findByTestId('save-failure-alert');
    expect(screen.getByTestId('code-editor').firstElementChild).toBe(alert);
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Mech');
    expect(toast).not.toHaveBeenCalled();
  });

  it('retiring a code ends in a toast and closes the confirmation', async () => {
    reply = (call) => (call.method === 'POST' ? jsonResponse(200, { ...CODE, active: false }) : call.url.pathname.endsWith('/references') ? jsonResponse(200, { activeChildren: 0, events: 0, mappingRules: 0 }) : undefined);
    wrap(<CodeRetireAction library="reason-codes" code={CODE} />);
    fireEvent.click(screen.getByTestId('code-retire'));
    fireEvent.click(await screen.findByRole('button', { name: 'Retire code' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'MECH retired' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('a new rule draft ends in the result dialog with View rule', async () => {
    reply = (call) => (call.method === 'POST' && call.url.pathname === '/api/v2/rules' ? jsonResponse(201, { ...RULE, id: 'rule-9', name: 'Night stops' }) : undefined);
    wrap(<RuleEditor schema={SCHEMA} rule={null} />);
    expect(screen.getByTestId('rule-cancel').getAttribute('href')).toBe('/master-data/codes-rules?tab=rules');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Night stops' } });
    fireEvent.click(screen.getByTestId('rule-save'));
    const result = await screen.findByTestId('save-result-dialog');
    expect(within(result).getByText('Rule draft created')).toBeTruthy();
    expect(within(result).getByRole('link', { name: 'View rule' }).getAttribute('href')).toBe('/master-data/codes-rules/rules/rule-9');
    expect(within(result).getByRole('link', { name: 'Back to Rules' }).getAttribute('href')).toBe('/master-data/codes-rules?tab=rules');
  });

  it('saving the draft of an existing rule ends in a toast', async () => {
    reply = (call) => (call.method === 'PUT' ? jsonResponse(200, { ...RULE, rowVersion: 2 }) : undefined);
    wrap(<RuleEditor schema={SCHEMA} rule={RULE} />);
    fireEvent.click(screen.getByTestId('rule-save'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Rule draft saved' }));
    expect(screen.queryByTestId('save-result-dialog')).toBeNull();
  });

  it('activation: success is a toast; a refusal is the red alert inside the confirmation', async () => {
    actAs('Manager', 'u2');
    let refuse = true;
    reply = (call) => {
      if (!call.url.pathname.endsWith('/activate')) return undefined;
      return refuse ? jsonResponse(409, errorBody('RULE_NO_DRAFT', 'no draft')) : jsonResponse(200, { ...RULE, state: 'active', activeVersion: 1 });
    };
    wrap(<RuleActions rule={RULE} currentUserId="u2" />);
    fireEvent.click(screen.getByTestId('rule-activate'));
    fireEvent.click(await screen.findByRole('button', { name: 'Activate rule' }));
    const alert = await within(screen.getByRole('alertdialog')).findByTestId('save-failure-alert');
    expect(within(alert).getByTestId('admin-refusal')).toHaveAttribute('data-status', '409');
    expect(toast).not.toHaveBeenCalled();
    refuse = false;
    fireEvent.click(screen.getByRole('button', { name: 'Activate rule' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: '“Long stops” activated' }));
  });
});
