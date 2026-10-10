import { useQuery } from '@tanstack/react-query';
import { ifMatchOf } from '../etag-cache';
import { newIdempotencyKey } from '../idempotency';
import type { BodyOf } from '../schema-types';
import type { RuleCheckView, RuleDefinitionDef, RuleKind, RuleSimulationView, RulesSchemaView, RuleVersionView, RuleView } from '../types/rules';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export type RuleCreateBody = Omit<BodyOf<'/api/v2/rules', 'post'>, 'definition'> & { definition: RuleDefinitionDef };
export type RuleChangeBody = Omit<BodyOf<'/api/v2/rules/{id}', 'put'>, 'definition'> & { definition?: RuleDefinitionDef };
export type RuleSimulateBody = BodyOf<'/api/v2/rules/{id}/simulate', 'post'>;

type RuleRef = Pick<RuleView, 'id' | 'rowVersion'>;

/** Rules of the acting tenant, newest first. */
export function useRules() {
  const list = useV2InfiniteList<RuleView>({ resource: 'rules', path: '/rules', query: { limit: 200 }, key: {} });
  return { ...list, items: flattenPages(list.data?.pages) };
}

export function useRule(id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'rules', id ?? '-'),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME.rules,
    queryFn: async ({ signal }) => (await v2.get<RuleView, '/api/v2/rules/{id}'>('/api/v2/rules/{id}', { path: { id: id as string }, signal })).data,
  });
}

export function useRuleVersions(id: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'rules', id ?? '-', 'versions'),
    enabled: Boolean(tenantId && id),
    staleTime: STALE_TIME.rules,
    queryFn: async ({ signal }) =>
      (await v2.get<RuleVersionView[], '/api/v2/rules/{id}/versions'>('/api/v2/rules/{id}/versions', { path: { id: id as string }, signal })).data,
  });
}

/** The grammar allowlist (fields, operators, actions per kind): fixed per server build. */
export function useRulesSchema() {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'rules', 'schema'),
    enabled: Boolean(tenantId),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) => (await v2.get<RulesSchemaView, '/api/v2/rules/schema'>('/api/v2/rules/schema', { signal })).data,
  });
}

/**
 * Live server validation of a draft (nothing stored): the same checks as save, so the builder shows
 * exactly the 422 field errors a save would get. `definition` null = nothing to check yet.
 */
export function useRuleCheck(kind: RuleKind, definition: RuleDefinitionDef | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: [...v2Keys.detail(tenantId ?? '-', 'rules', 'check'), kind, definition] as const,
    enabled: Boolean(tenantId && definition),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) =>
      (await v2.post<RuleCheckView, '/api/v2/rules/validate'>('/api/v2/rules/validate', {
        body: { kind, definition: definition as RuleDefinitionDef },
        idempotencyKey: newIdempotencyKey(),
        signal,
      })).data,
  });
}

function useRuleCommand<TInput, TResult>(run: (input: TInput, idempotencyKey: string) => Promise<TResult>, mutates = true) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, TResult>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => (mutates && tenantId ? { tenantId, entityType: 'rule' } : null),
  });
}

export function useCreateRule() {
  return useRuleCommand<RuleCreateBody, RuleView>(async (body, idempotencyKey) =>
    (await v2.post<RuleView, '/api/v2/rules'>('/api/v2/rules', { body, idempotencyKey })).data,
  );
}

export function useChangeRule() {
  return useRuleCommand<{ rule: RuleRef; body: RuleChangeBody }, RuleView>(async (input) =>
    (await v2.put<RuleView, '/api/v2/rules/{id}'>('/api/v2/rules/{id}', {
      path: { id: input.rule.id },
      body: input.body,
      ifMatch: ifMatchOf(input.rule.rowVersion),
    })).data,
  );
}

/** Simulation records a run but changes no event; the rule views stay valid. */
export function useSimulateRule() {
  return useRuleCommand<{ id: string; body: RuleSimulateBody }, RuleSimulationView>(async (input, idempotencyKey) =>
    (await v2.post<RuleSimulationView, '/api/v2/rules/{id}/simulate'>('/api/v2/rules/{id}/simulate', {
      path: { id: input.id },
      body: input.body,
      idempotencyKey,
    })).data,
  false);
}

export function useActivateRule() {
  return useRuleCommand<{ rule: RuleRef; reason?: string }, RuleView>(async (input, idempotencyKey) =>
    (await v2.post<RuleView, '/api/v2/rules/{id}/activate'>('/api/v2/rules/{id}/activate', {
      path: { id: input.rule.id },
      body: input.reason ? { reason: input.reason } : {},
      idempotencyKey,
      ifMatch: ifMatchOf(input.rule.rowVersion),
    })).data,
  );
}

export function useRollbackRule() {
  return useRuleCommand<{ rule: RuleRef; toVersion: number; reason?: string }, RuleView>(async (input, idempotencyKey) =>
    (await v2.post<RuleView, '/api/v2/rules/{id}/rollback'>('/api/v2/rules/{id}/rollback', {
      path: { id: input.rule.id },
      body: { toVersion: input.toVersion, ...(input.reason ? { reason: input.reason } : {}) },
      idempotencyKey,
      ifMatch: ifMatchOf(input.rule.rowVersion),
    })).data,
  );
}

export function useRetireRule() {
  return useRuleCommand<{ rule: RuleRef }, RuleView>(async (input, idempotencyKey) =>
    (await v2.post<RuleView, '/api/v2/rules/{id}/retire'>('/api/v2/rules/{id}/retire', {
      path: { id: input.rule.id },
      idempotencyKey,
      ifMatch: ifMatchOf(input.rule.rowVersion),
    })).data,
  );
}
