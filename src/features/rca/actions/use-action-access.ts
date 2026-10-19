import type { RcaActionView } from '@/api/v2/types/rca';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { useOptionalCaseWorkspace } from '../case/case-context';
import { actionAccessOf, NO_ACTION_ACCESS, type ActionAccess } from '../model/action-access';

/** The signed-in user's access to one action (RCA writer, or its owner); none inside a closed investigation. */
export function useActionAccess(action: Pick<RcaActionView, 'ownerId' | 'status'>): ActionAccess {
  const { canWriteRca } = useCapabilities();
  const userId = useCurrentUserId();
  const workspace = useOptionalCaseWorkspace();
  if (workspace?.closed) return NO_ACTION_ACCESS;
  return actionAccessOf(action, { canWriteRca, userId });
}
