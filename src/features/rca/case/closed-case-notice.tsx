import { StatusIcon } from '@/lib/icons';
import { CLOSED_CASE_NOTICE } from '../model/closed-case';
import { useCaseWorkspace } from './case-context';

/** QA H1: tells an RCA writer why a closed investigation shows no edit controls (reopen is in Overview). */
export function ClosedCaseNotice() {
  const { closed, canWrite } = useCaseWorkspace();
  if (!closed || !canWrite) return null;
  return (
    <p role="note" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground" data-testid="closed-case-notice">
      <StatusIcon.locked className="h-4 w-4" aria-hidden />
      {CLOSED_CASE_NOTICE}
    </p>
  );
}
