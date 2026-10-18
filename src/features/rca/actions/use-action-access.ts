import type { RcaActionView } from '@/api/v2/types/rca';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { actionAccessOf, type ActionAccess } from '../model/action-access';

/** The signed-in user's access to one action (RCA writer, or its owner). */
export function useActionAccess(action: Pick<RcaActionView, 'ownerId' | 'status'>): ActionAccess {
  const { canWriteRca } = useCapabilities();
  const userId = useCurrentUserId();
  return actionAccessOf(action, { canWriteRca, userId });
}
