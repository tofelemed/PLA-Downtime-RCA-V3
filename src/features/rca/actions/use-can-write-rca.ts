import { useCapabilities } from '@/features/auth/use-capabilities';
import { useOptionalCaseWorkspace } from '../case/case-context';

/** RCA write capability here: false inside a closed investigation's workspace (QA H1, reopen to change). */
export function useCanWriteRca(): boolean {
  const { canWriteRca } = useCapabilities();
  const workspace = useOptionalCaseWorkspace();
  return canWriteRca && !(workspace?.closed ?? false);
}
