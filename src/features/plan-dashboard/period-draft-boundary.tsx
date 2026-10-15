import { useEffect, useLayoutEffect } from 'react';
import { usePeriodDraftOwner } from './hooks/use-period-draft-owner';
import { retainedPeriodDrafts } from './model/retained-period-drafts';

/** Lives outside routes: retained edits warn on reload even after navigating to another page. */
export function PeriodDraftBoundary(): null {
  const owner = usePeriodDraftOwner();
  useLayoutEffect(() => { retainedPeriodDrafts.setOwner(owner); }, [owner]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!retainedPeriodDrafts.hasPending()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  return null;
}
