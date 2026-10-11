import { useAuth } from '@/contexts/AuthContext';

/** Id of the signed-in user (separation-of-duties checks), null when signed out. */
export function useCurrentUserId(): string | null {
  const { session } = useAuth();
  return session?.user?.id ?? null;
}
