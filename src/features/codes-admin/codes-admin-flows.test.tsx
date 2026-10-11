import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { CodeDetailView } from '@/api/v2/types/codes-admin';
import type { RulesSchemaView, RuleView } from '@/api/v2/types/rules';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RuleEditor } = await import('./rules/rule-editor');
const { RetireDialog } = await import('./codes/retire-dialog');
const { CodeDetail } = await import('./codes/code-detail');
const { RuleDetail } = await import('./rules/rule-detail');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } });

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

const CODE: CodeDetailView = {
  id: 'r1', library: 'reason', code: 'MECH', name: 'Mechanical', description: null, parentId: null, path: 'r1', level: 0, version: 1, rowVersion: 1,
  effectiveFrom: null, effectiveTo: null, active: true,
};

describe('codes & rules flows (plan 3.8)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode) => render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);

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
    expect(within(screen.getAllByTestId('rule-condition')[0]).getByTestId('row-error').textContent).toBe('value: must be a number');
    const sent = { body: lastCheck() };
    expect(JSON.stringify(sent?.body)).not.toMatch(/function|=>/);
  });

  it('retire shows the server reference counts first and the 409 counts when refused', async () => {
    reply = (call) => {
      if (call.method === 'GET') return json(200, { activeChildren: 1, events: 4, mappingRules: 2 });
      return json(409, { code: 'CODE_HAS_CHILDREN', message: 'has children', correlationId: 'c9', retryable: false, details: { references: { activeChildren: 1, events: 4, mappingRules: 2 } } });
    };
    wrap(<RetireDialog library="reason-codes" code={CODE} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('impact-children')).toHaveAttribute('data-count', '1'));
    expect(screen.getByTestId('impact-events')).toHaveAttribute('data-count', '4');
    fireEvent.click(screen.getByTestId('retire-confirm'));
    const refusal = await screen.findByTestId('admin-refusal');
    expect(refusal).toHaveAttribute('data-code', 'CODE_HAS_CHILDREN');
    expect(refusal).toHaveAttribute('data-status', '409');
    expect(screen.getByTestId('refusal-references').textContent).toContain('1 active child code(s), 4 event(s), 2 mapping rule(s)');
    expect(calls.find((call) => call.method === 'POST')?.url.pathname).toBe('/api/v2/reason-codes/r1/retire');
  });

  describe('controls follow CODE_WRITERS, RULE_AUTHORS and RULE_APPROVERS (owner decision 2026-10-12)', () => {
    const RULE: RuleView = {
      id: 'rule-1', kind: 'coding_default', name: 'Long stops', description: null, priority: 0, state: 'draft', activeVersion: null, activeDefinition: null,
      draft: { definition: { when: { all: [] }, then: [] }, authorId: 'author-1', updatedAt: null }, appliedBy: 'v2 create', rowVersion: 1, createdAt: '', createdBy: 'author-1', retiredAt: null,
    };
    const ruleDetail = (userId: string) => wrap(<RuleDetail rule={RULE} schema={SCHEMA} timezone="UTC" currentUserId={userId} />);

    it('canWriteCodes: a master-data admin retires and saves codes; an engineer sees neither', () => {
      reply = () => json(200, list([]));
      actAs('master_data_admin');
      const admin = wrap(<CodeDetail library="reason-codes" code={CODE} codes={[CODE]} />);
      expect(screen.getByTestId('code-retire')).toBeTruthy();
      expect(screen.getByTestId('code-save')).toBeTruthy();
      admin.unmount();
      actAs('Engineer');
      wrap(<CodeDetail library="reason-codes" code={CODE} codes={[CODE]} />);
      expect(screen.queryByTestId('code-retire')).toBeNull();
      expect(screen.queryByTestId('code-save')).toBeNull();
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
