import { useAssignableUsers as useDirectoryMembers } from '@/api/v2/queries/administration-users';
import type { UserDirectoryEntry } from '@/api/v2/types/administration';

export type AssignableUser = Pick<UserDirectoryEntry, 'id' | 'name'>;

/** Active members of the plant for owner and team pickers (`GET /v2/users/directory`, first 500 by name). */
export function useAssignableUsers(): { users: AssignableUser[]; isLoading: boolean } {
  const query = useDirectoryMembers();
  return { users: query.data?.items ?? [], isLoading: query.isLoading };
}
