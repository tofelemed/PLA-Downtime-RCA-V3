import { useMemo } from 'react';
import { useAssignableUsers, useUserDirectoryNames } from '@/api/v2/queries/administration-users';
import { useNameResolver, type NameResolver } from './name-resolver';

/**
 * User names from the v2 user directory (`GET /v2/users/directory`, readable by every member): the plant's
 * active members, plus — for the `ids` a screen passes — members who are deactivated and users placed in
 * no plant (backend item B2). Users of another plant stay "Unknown user"; a refused or failed call
 * degrades to the fallback silently.
 *
 * @example const users = useUserNames(entries.map((e) => e.actorId)); users.nameOf(entry.actorId)
 */
export function useUserNames(ids: readonly (string | null | undefined)[] = []): NameResolver {
  const members = useAssignableUsers();
  const memberEntries = members.data?.items;
  const missing = useMemo(() => {
    const known = new Set((memberEntries ?? []).map((entry) => entry.id));
    return ids.filter((id): id is string => Boolean(id) && !known.has(id as string));
  }, [ids, memberEntries]);
  const others = useUserDirectoryNames(members.isLoading ? [] : missing);
  const otherEntries = others.data?.items;
  const entries = useMemo(() => [...(memberEntries ?? []), ...(otherEntries ?? [])], [memberEntries, otherEntries]);
  return useNameResolver(entries, members.isLoading || (missing.length > 0 && others.isLoading), 'Unknown user');
}
