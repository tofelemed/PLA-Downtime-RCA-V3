import { userApi } from '@/services/api/userApi';
import { useV1Directory } from './directory-query';
import { useNameResolver, type NameResolver } from './name-resolver';

const fetchUsers = () => userApi.getAssignableUsers();

/**
 * User names from `GET /users/assignable` (id + name of the plant's active users; every member may read
 * it). Former or deactivated users, and actors of other plants, resolve to "Unknown user"; a refused or
 * failed call degrades to the fallback silently (no error UI, no retry on 4xx).
 */
export function useUserNames(): NameResolver {
  const query = useV1Directory(['users', 'assignable'], fetchUsers);
  return useNameResolver(query.data, query.isLoading, 'Unknown user');
}
