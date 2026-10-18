import { useCallback, useMemo, useRef, useState } from 'react';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { shouldRetryQuery } from '@/app/query-client';
import { useAssignableUsers } from '@/api/v2/queries/administration-users';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { STALE_TIME } from '@/api/v2/queries/stale-times';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { FORMER_USER_TEXT } from './actor-labels';
import type { NameResolver } from './name-resolver';
import { loadPersonName } from './person-directory';

/** A user id the plant directory does not return: a former member or a user of another plant. */
export const FORMER_USER = FORMER_USER_TEXT;
/** The directory could not be read (refused or failed): the name is unknown, not "former". */
export const UNKNOWN_USER = 'Unknown user';
/** Shown while a name is being looked up (never the id). */
export const NAME_LOADING = '…';

/** Per looked-up id, in query order: the name, null (not in the directory), "failed" or undefined (loading). */
type LookupState = string | null | 'failed' | undefined;

function combineLookups(results: UseQueryResult<string | null>[]): LookupState[] {
  return results.map((result) => (result.isError ? 'failed' : result.data));
}

function personText(state: LookupState): string {
  if (state === 'failed') return UNKNOWN_USER;
  if (state === null) return FORMER_USER;
  return state ?? NAME_LOADING;
}

function uniqueIds(...lists: readonly (readonly (string | null | undefined)[])[]): string[] {
  return [...new Set(lists.flat().filter((id): id is string => Boolean(id)))].sort();
}

/**
 * User names, the one way to show a person (owner finding 1: never "a user", never an id). Plant members
 * come from the cached member directory (`GET /v2/users/directory`, one call); any other id — passed in
 * `ids` or first met by `nameOf` — is looked up by id, batched into one call per tick and cached per id
 * (`loadPersonName`). An id the directory does not return reads "Former user"; a refused directory reads
 * "Unknown user". Show system actors with `actorText` / `<ActorName>`, not with this hook.
 *
 * @example const users = useUserNames(entries.map((e) => e.actorId)); users.nameOf(entry.actorId)
 */
export function useUserNames(ids: readonly (string | null | undefined)[] = []): NameResolver {
  const members = useMemberNames();
  const { met, meet } = useMetIds();
  const idKey = members.isLoading || members.refused ? '' : uniqueIds(ids, met).filter((id) => !members.names.has(id)).join(',');
  const lookups = usePersonLookups(idKey);
  return useMemo<NameResolver>(
    () => ({
      nameOf: (id) => {
        if (!id) return '—';
        const member = members.names.get(id);
        if (member) return member;
        if (members.isLoading) return NAME_LOADING;
        if (members.refused) return UNKNOWN_USER;
        if (!lookups.has(id)) {
          meet(id);
          return NAME_LOADING;
        }
        return personText(lookups.get(id));
      },
      isLoading: members.isLoading || [...lookups.values()].some((state) => state === undefined),
    }),
    [members, lookups, meet],
  );
}

/** The plant's active members (one cached call), by id. */
function useMemberNames() {
  const query = useAssignableUsers();
  const names = useMemo(() => {
    const byId = new Map<string, string>();
    for (const entry of query.data?.items ?? []) if (entry.name?.trim()) byId.set(entry.id, entry.name.trim());
    return byId;
  }, [query.data]);
  return useMemo(() => ({ names, isLoading: query.isLoading, refused: query.isError }), [names, query.isLoading, query.isError]);
}

/** Ids first met while rendering (`nameOf`), added after the render so they are looked up too. */
function useMetIds() {
  const [met, setMet] = useState<readonly string[]>([]);
  const asked = useRef(new Set<string>());
  const meet = useCallback((id: string) => {
    if (asked.current.has(id)) return;
    asked.current.add(id);
    queueMicrotask(() => setMet((previous) => (previous.includes(id) ? previous : [...previous, id])));
  }, []);
  return { met, meet };
}

/** Per-id name lookups (`idKey` = sorted ids joined by ","), cached per tenant and id, batched per tick. */
function usePersonLookups(idKey: string): ReadonlyMap<string, LookupState> {
  const tenantId = useV2TenantId();
  const ids = useMemo(() => (idKey ? idKey.split(',') : []), [idKey]);
  const states = useQueries({
    queries: ids.map((id) => ({
      queryKey: v2Keys.detail(tenantId ?? '-', 'users', id, 'name'),
      queryFn: () => loadPersonName(tenantId ?? '-', id),
      enabled: Boolean(tenantId),
      staleTime: STALE_TIME.users,
      retry: shouldRetryQuery,
    })),
    combine: combineLookups,
  });
  const stateKey = states.map(String).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `states` is rebuilt each render; `stateKey` is its content
  return useMemo(() => new Map(ids.map((id, index) => [id, states[index]] as const)), [ids, stateKey]);
}
