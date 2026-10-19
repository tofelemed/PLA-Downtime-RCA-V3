import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { CodeDetailView } from '@/api/v2/types/codes-admin';
import type { RulesSchemaView, RuleView } from '@/api/v2/types/rules';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RuleEditor } = await import('./rules/rule-editor');
const { CodeRetireAction } = await import('./codes/code-retire-action');
const { CodeHeaderActions } = await import('./codes/code-header-actions');
const { CodeEditor } = await import('./codes/code-editor');
const { CodeTree } = await import('./codes/code-tree');
const { CodeSearchResults } = await import('./codes/code-search-results');
const { RuleDetail } = await import('./rules/rule-detail');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } });

const SCHEMA: RulesSchemaView = {
  grammarVersion: 1,
  schemaId: 'x',
  limits: { maxConditions: 20, maxDepth: 2, maxActions: 10, maxListValues: 50, maxGlobLength: 100, stepBudget: 10000 },
  operators: [
    { op: 'eq', label: 'equals', value: 'single' },
    { op: 'gte', label: 'at least', value: 'single' },
  ],
  fields: [
    { name: 'physicalType', label: 'Physical type', type: 'enum', values: ['downtime'], operators: ['eq'] },
    { name: 'durationSeconds', label: 'Duration (seconds)', type: 'number', operators: ['eq', 'gte'] },
  ],
  kinds: [{ kind: 'coding_default', label: 'Coding default', sets: [{ field: 'scheduleClass', label: 'Schedule class', values: ['unplanned'] }], flags: false, appliedBy: 'v2 create' }],
};

const code = (patch: Partial<CodeDetailView>): CodeDetailView => ({
  id: 'r1', library: 'reason', code: 'MECH', name: 'Mechanical', description: null, parentId: null, path: 'r1', level: 0, version: 1, rowVersion: 1,
  effectiveFrom: null, effectiveTo: null, active: true, ...patch,
});
const CODE = code({});

describe('codes & rules flows (plan 3.8)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  it('the builder sends JSON only and shows the server field errors on the row they name', async () => {
    reply = (call) => {
      if (call.url.pathname.endsWith('/rules/validate')) {
        return json(200, { valid: false, conditionCount: 1, fieldErrors: [{ field: 'definition.when.all.0.value', message: 'must be a number' }] });
      }
      return json(200, list([]));
    };
    wrap(<RuleEditor schema={SCHEMA} rule={null} onSaved={() => undefined} />);
    const row = screen.getAllByTestId('rule-condition')[0];
    fireEvent.change(within(row).getByLabelText('Field'), { target: { value: 'durationSeconds' } });
    fireEvent.change(within(row).getByLabelText('Operator'), { target: { value: 'gte' } });
    fireEvent.change(within(row).getByLabelText('Value for Duration (seconds)'), { target: { value: '3600' } });
    const lastCheck = () => calls.filter((call) => call.url.pathname.endsWith('/rules/validate')).at(-1)?.body;
    await waitFor(
      () =>
        expect(lastCheck()).toEqual({
          kind: 'coding_default',
          definition: { when: { all: [{ field: 'durationSeconds', op: 'gte', value: 3600 }] }, then: [{ set: '', value: '' }] },
        }),
      { timeout: 3000 },
    );
    await waitFor(() => expect(screen.getByTestId('rule-validation')).toHaveAttribute('data-state', 'invalid'));
    expect(within(screen.getAllByTestId('rule-condition')[0]).getByTestId('row-error').textContent).toBe('Value: must be a number');
    expect(JSON.stringify(lastCheck())).not.toMatch(/function|=>/);
  });

  it('retire asks first, shows the server reference counts and keeps the 409 in the dialog in plain words', async () => {
    reply = (call) => {
      if (call.url.pathname.endsWith('/references')) return json(200, { activeChildren: 1, events: 4, mappingRules: 2 });
      if (call.method === 'POST') {
        return json(409, { code: 'CODE_HAS_CHILDREN', message: 'has children', correlationId: 'c9', retryable: false, details: { references: { activeChildren: 1, events: 4, mappingRules: 2 } } });
      }
      return json(200, list([]));
    };
    wrap(<CodeRetireAction library="reason-codes" code={CODE} />);
    expect(calls.some((call) => call.url.pathname.endsWith('/references'))).toBe(false);
    fireEvent.click(screen.getByTestId('code-retire'));
    await waitFor(() => expect(screen.getByTestId('impact-children')).toHaveAttribute('data-count', '1'));
    expect(screen.getByTestId('impact-events')).toHaveAttribute('data-count', '4');
    fireEvent.click(screen.getByRole('button', { name: 'Retire code' }));
    const refusal = await screen.findByTestId('admin-refusal');
    expect(refusal).toHaveAttribute('data-code', 'CODE_HAS_CHILDREN');
    expect(refusal).toHaveAttribute('data-status', '409');
    expect(refusal.textContent).toContain('This code has sub-codes');
    expect(refusal.textContent).not.toMatch(/CODE_HAS_CHILDREN|c9|409/);
    expect(screen.getByTestId('refusal-references').textContent).toContain('1 active sub-code, 4 events and 2 default mapping versions');
    expect(calls.find((call) => call.method === 'POST')?.url.pathname).toBe('/api/v2/reason-codes/r1/retire');
  });

  it('the tree starts collapsed: top-level codes 20 per page, sub-codes loaded only when a node opens', async () => {
    reply = (call) => {
      if (call.url.searchParams.get('rootsOnly') === 'true') return json(200, list([CODE]));
      if (call.url.searchParams.get('parentId') === 'r1') return json(200, list([code({ id: 'r2', code: 'MECH-BRG', name: 'Bearing', parentId: 'r1', level: 1 })]));
      return json(200, list([]));
    };
    wrap(<CodeTree library="reason-codes" includeRetired={false} />);
    const root = await screen.findByText('MECH');
    const roots = calls.find((call) => call.url.searchParams.get('rootsOnly') === 'true');
    expect(roots?.url.searchParams.get('limit')).toBe('20');
    expect(root.closest('a')?.getAttribute('href')).toBe('/master-data/codes-rules/reason-codes/r1');
    expect(calls.some((call) => call.url.searchParams.has('parentId'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Show sub-codes of MECH' }));
    expect(await screen.findByText('MECH-BRG')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide sub-codes of MECH' })).toHaveAttribute('aria-expanded', 'true');
    // QA M8 (axe `listitem`): every code row, nested ones too, sits directly in a list that keeps list semantics
    const rows = screen.getAllByTestId('code-row');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.parentElement?.tagName).toBe('UL');
      expect(row.parentElement?.getAttribute('role') ?? 'list').toBe('list');
    }
    expect(screen.getByRole('list', { name: 'Sub-codes of MECH' })).toBeTruthy();
  });

  it('search finds codes at any depth and says where they sit (lookup follows every page)', async () => {
    reply = (call) =>
      call.url.searchParams.get('cursor') === 'p2'
        ? json(200, list([code({ id: 'r3', code: 'MECH-BRG-01', name: 'Bearing seized', parentId: 'r2', level: 2 })]))
        : json(200, list([CODE, code({ id: 'r2', code: 'MECH-BRG', name: 'Bearing', parentId: 'r1', level: 1 })], 'p2'));
    wrap(<CodeSearchResults library="reason-codes" includeRetired={false} text="seized" />);
    expect(await screen.findByText('MECH-BRG-01')).toBeTruthy();
    expect(screen.getByText('Mechanical › Bearing')).toBeTruthy();
    expect(calls.filter((call) => call.url.pathname === '/api/v2/reason-codes')).toHaveLength(2);
  });

  describe('controls follow CODE_WRITERS, RULE_AUTHORS and RULE_APPROVERS (owner decision 2026-10-12)', () => {
    const RULE: RuleView = {
      id: 'rule-1', kind: 'coding_default', name: 'Long stops', description: null, priority: 0, state: 'draft', activeVersion: null, activeDefinition: null,
      draft: { definition: { when: { all: [] }, then: [] }, authorId: 'author-1', updatedAt: null }, appliedBy: 'v2 create', rowVersion: 1, createdAt: '', createdBy: 'author-1', retiredAt: null,
    };
    const ruleDetail = (userId: string) => wrap(<RuleDetail rule={RULE} schema={SCHEMA} currentUserId={userId} />);
    const codeScreen = () => (
      <>
        <CodeHeaderActions library="reason-codes" code={CODE} />
        <CodeEditor library="reason-codes" code={CODE} />
      </>
    );

    it('canWriteCodes: a master-data admin retires, adds sub-codes and saves; an engineer sees none of it', () => {
      reply = () => json(200, list([]));
      actAs('master_data_admin');
      const admin = wrap(codeScreen());
      expect(screen.getByTestId('code-retire')).toBeTruthy();
      expect(screen.getByTestId('code-save')).toBeTruthy();
      expect(screen.getByTestId('code-new-child')).toBeTruthy();
      admin.unmount();
      actAs('Engineer');
      wrap(codeScreen());
      expect(screen.queryByTestId('code-retire')).toBeNull();
      expect(screen.queryByTestId('code-save')).toBeNull();
      expect(screen.queryByTestId('code-new-child')).toBeNull();
    });

    it('canApproveRules: a master-data admin authors but never sees Activate / Retire; a manager does', () => {
      reply = () => json(200, list([]));
      actAs('master_data_admin', 'u2');
      const author = ruleDetail('u2');
      expect(screen.queryByTestId('rule-activate')).toBeNull();
      expect(screen.queryByTestId('rule-retire')).toBeNull();
      expect(screen.getByTestId('rule-save')).toBeTruthy();
      author.unmount();
      actAs('Manager', 'u2');
      ruleDetail('u2');
      expect((screen.getByTestId('rule-activate') as HTMLButtonElement).disabled).toBe(false);
      expect(screen.getByTestId('rule-retire')).toBeTruthy();
    });

    it('retiring a rule asks first; nothing is sent until the confirmation', async () => {
      reply = () => json(200, list([]));
      actAs('Manager', 'u2');
      ruleDetail('u2');
      fireEvent.click(screen.getByTestId('rule-retire'));
      expect(await screen.findByRole('alertdialog')).toBeTruthy();
      expect(calls.some((call) => call.url.pathname.endsWith('/retire'))).toBe(false);
    });

    it('the draft author who can approve gets Activate disabled with the separation-of-duties tooltip', () => {
      reply = () => json(200, list([]));
      actAs('Manager', 'author-1');
      ruleDetail('author-1');
      expect((screen.getByTestId('rule-activate') as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByTestId('sod-disabled').getAttribute('title')).toMatch(/separation of duties/);
    });

    it('canAuthorRules: an operator sees no save button on the builder', () => {
      reply = () => json(200, list([]));
      actAs('Operator');
      wrap(<RuleEditor schema={SCHEMA} rule={RULE} onSaved={() => undefined} />);
      expect(screen.queryByTestId('rule-save')).toBeNull();
    });
  });
});
