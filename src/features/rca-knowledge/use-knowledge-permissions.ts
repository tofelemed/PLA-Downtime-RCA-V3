import { useCapabilities } from '@/features/auth/use-capabilities';
import { canPublishKnowledge, canShareKnowledge } from './model/knowledge-filters';

/**
 * What the knowledge screen offers the signed-in user, from the effective roles in the selected plant:
 * publish / unpublish for RCA writers, share / unshare for manager approvers (computed here from `roles`,
 * mirroring the server's `@Roles`),
 * votes for anyone who is not read-only. The server still refuses what the roles do not allow.
 */
export function useKnowledgePermissions(): { canPublish: boolean; canShare: boolean; canVote: boolean } {
  const capabilities = useCapabilities();
  return {
    canPublish: canPublishKnowledge(capabilities.roles),
    canShare: canShareKnowledge(capabilities.roles),
    canVote: !capabilities.isReadOnly,
  };
}
