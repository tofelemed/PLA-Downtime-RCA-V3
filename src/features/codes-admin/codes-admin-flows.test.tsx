import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { CodeDetailView } from '@/api/v2/types/codes-admin';
import type { RulesSchemaView } from '@/api/v2/types/rules';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' }, user: { id: 'u1' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RuleEditor } = await import('./rules/rule-editor');
const { RetireDialog } = await import('./codes/retire-dialog');

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
  afterEach(() => vi.unstubAllGlobals());

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
});
