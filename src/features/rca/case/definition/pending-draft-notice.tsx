import { Link, useLocation } from 'react-router-dom';
import { useCaseWorkspace } from '../case-context';
import { retainedDefinitionDrafts } from './retained-definition-drafts';
import { useRcaDraftOwner } from './use-definition-draft';

/**
 * QA L4: on the other tabs of the workspace, says that unsaved definition edits are kept as a draft for
 * this session, with a link back to save or discard them (the definition page offers both).
 */
export function PendingDraftNotice() {
  const { rca, basePath, readOnly } = useCaseWorkspace();
  const owner = useRcaDraftOwner();
  const { pathname } = useLocation();
  if (readOnly || pathname.endsWith('/definition') || !retainedDefinitionDrafts.read(owner, rca.id)) return null;
  return (
    <p role="status" className="rounded-md border border-warning/40 px-3 py-1.5 text-sm" data-testid="pending-definition-draft">
      Unsaved changes to the definition are kept as a draft for this session.{' '}
      <Link className="underline" to={`${basePath}/definition`}>
        Open the definition to save or discard them
      </Link>
    </p>
  );
}
