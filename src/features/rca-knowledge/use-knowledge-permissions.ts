import { useCapabilities } from '@/features/auth/use-capabilities';
import { canPublishKnowledge } from './model/knowledge-filters';

/**
 * What the knowledge screen offers the signed-in user, from the effective roles in the selected plant:
 * publish / unpublish for RCA writers (computed here from `roles`, mirroring the server's `@Roles`),
 * votes for anyone who is not read-only. The server still refuses what the roles do not allow.
 */
export function useKnowledgePermissions(): { canPublish: boolean; canVote: boolean } {
  const capabilities = useCapabilities();
  return {
    canPublish: canPublishKnowledge(capabilities.roles),
    canVote: !capabilities.isReadOnly,
  };
}
