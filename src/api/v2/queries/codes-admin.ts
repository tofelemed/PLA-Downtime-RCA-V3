import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import { ifMatchOf } from '../etag-cache';
import type { BodyOf } from '../schema-types';
import type { ValuationRateView } from '../types/profiles';
import type {
  CodeDetailView,
  CodeLibraryPath,
  CodeMappingPreviewView,
  CodeMappingRuleView,
  CodeReferencesView,
  CodeVersionView,
  FailureGroupKind,
} from '../types/codes-admin';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { flattenPages, useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

/** Every library takes the same create / change bodies (fields of another library are 422). */
export type CodeCreateBody = BodyOf<'/api/v2/reason-codes', 'post'>;
export type CodeChangeBody = BodyOf<'/api/v2/reason-codes/{id}', 'put'>;
export type CodeMappingRuleBody = BodyOf<'/api/v2/code-mapping-rules', 'post'>;

export interface CodeListFilters {
  includeRetired?: boolean;
  groupKind?: FailureGroupKind;
}

/** All codes of one library of the acting tenant (NFR01: never another tenant's), pages of 500. */
export function useCodeList(library: CodeLibraryPath, filters: CodeListFilters = {}) {
  const list = useV2InfiniteList<CodeDetailView>({
    resource: 'codes',
    path: `/${library}`,
    query: { limit: 500, ...filters },
    key: { filters: { library, admin: true, ...filters } },
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}

function useCodeDetail<T>(library: CodeLibraryPath, id: string | null, variant: string, query?: Record<string, number>) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: [...v2Keys.detail(tenantId ?? '-', 'codes', id ?? '-', `${library}:${variant}`), query ?? null] as const,
    enabled: Boolean(tenantId && id),
    staleTime: 0,
    queryFn: async ({ signal }) =>
      (await v2Request<T>({ method: 'GET', path: `/${library}/${id as string}/${variant}`, query, signal })).data,
  });
}

export const useCodeVersions = (library: CodeLibraryPath, id: string | null) =>
  useCodeDetail<CodeVersionView[]>(library, id, 'versions');

/** Counts shown before a retire (the 409 of the retire itself carries the same counts). */
export const useCodeReferences = (library: CodeLibraryPath, id: string | null) =>
  useCodeDetail<CodeReferencesView>(library, id, 'references');

export const useCodeMappingPreview = (id: string | null, days = 30) =>
  useCodeDetail<CodeMappingPreviewView>('reason-codes', id, 'mapping-preview', { days });

function useCodeCommand<TInput, TResult>(run: (input: TInput, idempotencyKey: string) => Promise<TResult>, entityType = 'code') {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, TResult>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: () => (tenantId ? { tenantId, entityType } : null),
  });
}

export function useCreateCode(library: CodeLibraryPath) {
  return useCodeCommand<CodeCreateBody, CodeDetailView>(async (body, idempotencyKey) =>
    (await v2Request<CodeDetailView>({ method: 'POST', path: `/${library}`, body, idempotencyKey })).data,
  );
}

/** The next version of a code under If-Match (412 when someone else changed it). */
export function useChangeCode(library: CodeLibraryPath) {
  return useCodeCommand<{ code: Pick<CodeDetailView, 'id' | 'rowVersion'>; body: CodeChangeBody }, CodeDetailView>(async (input) =>
    (await v2Request<CodeDetailView>({
      method: 'PUT',
      path: `/${library}/${input.code.id}`,
      body: input.body,
      ifMatch: ifMatchOf(input.code.rowVersion),
    })).data,
  );
}

export function useRetireCode(library: CodeLibraryPath) {
  return useCodeCommand<{ id: string }, CodeDetailView>(async (input, idempotencyKey) =>
    (await v2Request<CodeDetailView>({ method: 'POST', path: `/${library}/${input.id}/retire`, body: {}, idempotencyKey })).data,
  );
}

/** Every version of the mapping rules of one source code (append-only history). */
export function useCodeMappingRules(sourceCodeId: string | null) {
  const list = useV2InfiniteList<CodeMappingRuleView>({
    resource: 'code-mapping-rules',
    path: '/code-mapping-rules',
    query: { limit: 500, sourceCodeId: sourceCodeId ?? undefined },
    key: { filters: { sourceCodeId } },
    enabled: Boolean(sourceCodeId),
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}

export function useCreateCodeMappingRule() {
  return useCodeCommand<CodeMappingRuleBody, CodeMappingRuleView>(async (body, idempotencyKey) =>
    (await v2Request<CodeMappingRuleView>({ method: 'POST', path: '/code-mapping-rules', body, idempotencyKey })).data,
    'code_mapping_rule',
  );
}

/** Valuation rate versions of an impact code (plan 2.6): the valuation link indicator. */
export function useImpactValuationRates(impactCodeId: string | null) {
  const list = useV2InfiniteList<ValuationRateView>({
    resource: 'profiles',
    path: '/valuation-rates',
    query: { impactCodeId: impactCodeId ?? undefined, limit: 20 },
    key: { filters: { kind: 'valuation-rates', impactCodeId } },
    enabled: Boolean(impactCodeId),
  });
  return { ...list, items: flattenPages(list.data?.pages) };
}
